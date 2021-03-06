package org.ironrhino.common.support;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

import javax.annotation.PostConstruct;

import org.apache.commons.lang3.StringUtils;
import org.hibernate.Session;
import org.hibernate.criterion.DetachedCriteria;
import org.hibernate.criterion.Order;
import org.hibernate.criterion.Restrictions;
import org.ironrhino.common.model.BasePollingEntity;
import org.ironrhino.common.model.PollingStatus;
import org.ironrhino.core.coordination.LockService;
import org.ironrhino.core.service.EntityManager;
import org.ironrhino.core.util.NameableThreadFactory;
import org.ironrhino.core.util.ReflectionUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.SmartLifecycle;
import org.springframework.data.redis.core.BoundListOperations;
import org.springframework.data.redis.core.SessionCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;

import lombok.Getter;
import lombok.Setter;

public abstract class AbstractPollingControl<T extends BasePollingEntity> implements SmartLifecycle {

	protected Logger logger = LoggerFactory.getLogger(getClass());

	@Autowired
	protected EntityManager<T> entityManager;

	@Autowired
	private LockService lockService;

	@Autowired
	protected StringRedisTemplate stringRedisTemplate;

	@Getter
	@Setter
	private int batchSize = 50;

	@Getter
	@Setter
	private int threads = 5;

	@Getter
	@Setter
	private int maxAttempts = 3;

	@Getter
	@Setter
	private int intervalFactorInSeconds = 60;

	@Getter
	@Setter
	private int resubmitIntervalInSeconds = 600;

	private AtomicBoolean running = new AtomicBoolean();

	private ThreadPoolExecutor threadPoolExecutor;

	private BoundListOperations<String, String> boundListOperations;

	protected Class<T> entityClass;

	protected String simpleUpdateStatusHql;

	protected String defaultUpdateStatusHql;

	protected String conditionalUpdateStatusHql;

	protected final AtomicInteger count = new AtomicInteger();

	public AbstractPollingControl() {
		@SuppressWarnings("unchecked")
		Class<T> clazz = (Class<T>) ReflectionUtils.getGenericClass(getClass());
		if (clazz == null)
			throw new IllegalArgumentException("Generic type must be present");
		entityClass = clazz;
	}

	@PostConstruct
	private void init() {
		simpleUpdateStatusHql = "update " + entityClass.getSimpleName()
				+ " t set t.status=?3,t.modifyDate=?4,t.errorInfo=?5 where t.id=?1 and t.status=?2";
		defaultUpdateStatusHql = "update " + entityClass.getSimpleName()
				+ " t set t.status=?3,t.modifyDate=?4,t.errorInfo=?5,t.attempts=t.attempts+1 where t.id=?1 and t.status=?2";
		conditionalUpdateStatusHql = "update " + entityClass.getSimpleName()
				+ " t set t.status=case when t.attempts+1>=?3 then ?4 else ?5 end,t.modifyDate=?6,t.errorInfo=?7,t.attempts=t.attempts+1 where t.id=?1 and t.status=?2";

		boundListOperations = stringRedisTemplate.boundListOps(getQueueName());
	}

	@Scheduled(fixedRateString = "${pollingControl.enqueue.fixedRate:10000}")
	public void enqueue() {
		if (!isRunning() || threadPoolExecutor.isShutdown())
			return;
		threadPoolExecutor.execute(() -> {
			String enqueueLockName = getQueueName() + ".enqueue()";
			count.incrementAndGet();
			if (lockService.tryLock(enqueueLockName)) {
				try {
					doEnqueue();
				} finally {
					lockService.unlock(enqueueLockName);
				}
			}
		});
	}

	protected void doEnqueue() {
		int current = count.get();
		entityManager.setEntityClass(entityClass);
		doEnqueueNormal();
		if (current % 5 == 1) {
			doEnqueueRetryable();
		}
		if (current % 10 == 1) {
			// resubmit entities which status are PROCESSING, maybe caused by jvm killed
			doEnqueueResubmittable();
		}
	}

	protected void doEnqueueNormal() {
		DetachedCriteria dc = entityManager.detachedCriteria();
		dc.add(Restrictions.eq("status", PollingStatus.INITIALIZED));
		dc.addOrder(Order.asc("createDate"));
		entityManager.iterate(batchSize, (entities, session) -> {
			for (T entity : entities) {
				entity.setStatus(PollingStatus.PROCESSING);
				entity.setModifyDate(new Date());
				session.update(entity);
			}
		}, entities -> {
			// enqueue after commit status change
			push(Arrays.stream(entities).map(entity -> {
				logger.info("enqueue {}", entity);
				return entity.getId();
			}).collect(Collectors.toList()), false);
		}, dc);
	}

	protected void doEnqueueRetryable() {
		for (int attempts = 1; attempts < getMaxAttempts(); attempts++) {
			DetachedCriteria dc = entityManager.detachedCriteria();
			dc.add(Restrictions.eq("status", PollingStatus.TEMPORARY_ERROR));
			dc.add(Restrictions.eq("attempts", attempts));
			dc.addOrder(Order.asc("createDate"));
			Calendar cal = Calendar.getInstance();
			cal.add(Calendar.SECOND, -getIntervalFactorInSeconds() * attempts);
			dc.add(Restrictions.lt("modifyDate", cal.getTime()));
			entityManager.iterate(10, (entities, session) -> {
				push(Arrays.stream(entities).map(entity -> {
					logger.info("enqueue {} retried", entity);
					return entity.getId();
				}).collect(Collectors.toList()), true);
			}, dc);
		}
		// abnormal retryable polling
		DetachedCriteria dc = entityManager.detachedCriteria();
		dc.add(Restrictions.eq("status", PollingStatus.TEMPORARY_ERROR));
		dc.add(Restrictions.ge("attempts", getMaxAttempts()));
		dc.addOrder(Order.asc("createDate"));
		Calendar cal = Calendar.getInstance();
		cal.add(Calendar.SECOND, -getIntervalFactorInSeconds() * getMaxAttempts());
		dc.add(Restrictions.lt("modifyDate", cal.getTime()));
		entityManager.iterate(10, (entities, session) -> {
			push(Arrays.stream(entities).map(entity -> {
				logger.info("enqueue {} retried", entity);
				return entity.getId();
			}).collect(Collectors.toList()), true);
		}, dc);
	}

	protected void doEnqueueResubmittable() {
		DetachedCriteria dc = entityManager.detachedCriteria();
		dc.add(Restrictions.eq("status", PollingStatus.PROCESSING));
		Calendar cal = Calendar.getInstance();
		cal.add(Calendar.SECOND, -getResubmitIntervalInSeconds());
		dc.add(Restrictions.lt("modifyDate", cal.getTime()));
		dc.addOrder(Order.asc("createDate"));
		entityManager.iterate(batchSize, (entities, session) -> {
			push(Arrays.stream(entities).map(entity -> {
				logger.info("enqueue {} resubmitted", entity);
				return entity.getId();
			}).collect(Collectors.toList()), true);
		}, dc);
	}

	@Scheduled(fixedDelayString = "${pollingControl.dequeue.fixedDelay:10000}")
	public void dequeue() {
		if (!isRunning() || threadPoolExecutor.isShutdown())
			return;
		for (int i = 0; i < getThreads() - threadPoolExecutor.getActiveCount(); i++)
			threadPoolExecutor.execute(this::doDequeue);
	}

	protected abstract void doDequeue();

	protected String getQueueName() {
		return entityClass.getName();
	}

	public long getQueueDepth() {
		Long size = boundListOperations.size();
		return size != null ? size : 0;
	}

	@SuppressWarnings({ "rawtypes", "unchecked" })
	protected void push(List<String> ids, boolean deduplication) {
		if (ids.isEmpty())
			return;
		if (deduplication) {
			List<String> prepend = new ArrayList<String>();
			List<String> append = new ArrayList<String>();
			List results = stringRedisTemplate.executePipelined((SessionCallback) redisOperations -> {
				for (String id : ids)
					redisOperations.opsForList().remove(boundListOperations.getKey(), 1, id);
				return null;
			});
			for (int i = 0; i < ids.size(); i++) {
				String id = ids.get(i);
				Long removed = (Long) results.get(i);
				if (removed != null && removed > 0) {
					prepend.add(id);
					logger.warn("cutting {}", id);
				} else {
					append.add(id);
				}
			}
			if (prepend.size() > 0)
				boundListOperations.rightPushAll(prepend.toArray(new String[prepend.size()]));
			if (append.size() > 0)
				boundListOperations.leftPushAll(append.toArray(new String[append.size()]));
		} else {
			boundListOperations.leftPushAll(ids.toArray(new String[ids.size()]));
		}
	}

	protected String pop() {
		return boundListOperations.rightPop();
	}

	protected boolean isTemporaryError(Exception e) {
		return e instanceof IOException || e.getCause() instanceof IOException;
	}

	protected void afterUpdated(Session session, T entity) {

	}

	@Override
	public boolean isRunning() {
		return running.get();
	}

	@Override
	public void start() {
		if (running.compareAndSet(false, true)) {
			threadPoolExecutor = (ThreadPoolExecutor) Executors.newFixedThreadPool(getThreads() + 1,
					new NameableThreadFactory(StringUtils.uncapitalize(getClass().getSimpleName()), (t, e) -> {
						logger.error(e.getMessage(), e);
					}));
			logger.info("Created thread pool {}", threadPoolExecutor);
		} else {
			logger.error("{} is already running", this);
		}
	}

	@Override
	public void stop() {
		if (running.compareAndSet(true, false)) {
			threadPoolExecutor.shutdown();
			try {
				threadPoolExecutor.awaitTermination(30, TimeUnit.SECONDS);
			} catch (InterruptedException e) {
				logger.error(e.getMessage(), e);
			}
			logger.info("Shutdown thread pool {}", threadPoolExecutor);
		} else {
			logger.error("{} is not running", this);
		}
	}

	@Override
	public int getPhase() {
		return 0;
	}

	@Override
	public boolean isAutoStartup() {
		return true;
	}

	@Override
	public void stop(Runnable runnable) {
		stop();
		runnable.run();
	}

}
