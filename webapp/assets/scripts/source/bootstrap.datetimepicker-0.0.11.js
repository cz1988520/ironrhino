/**
 * @license =========================================================
 *          bootstrap-datetimepicker.js
 *          http://www.eyecon.ro/bootstrap-datepicker
 *          ========================================================= Copyright
 *          2012 Stefan Petre
 * 
 * Contributions: - Andrew Rowls - Thiago de Arruda
 * 
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 * 
 * http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License. =========================================================
 */

// changes
// 0.change find('.input-append') to find('.input-append').length
// 1.change find('.input-prepend') to find('.input-prepend').length
// 2.if (icon && icon.length)
// 3.comment if (!this.isInput) on event mousedown.datetimepicker
// 4.change this.$element.outerHeight() to this.$element.outerHeight() + 5
// 5.exchange Hour pattern HH and hh
// 6.comment this.set(); in hide()
// 7.comment this.set(); in hide()
// 8.add if ($(document).height() - offset.top < 300)
// 9.rename icon- to glyphicon-
// 10.remove UTC and LocalDate and maskInput and use $.format.date
(function($) {

	// Picker object
	var smartPhone = (window.orientation != undefined);
	var DateTimePicker = function(element, options) {
		this.id = dpgId++;
		this.init(element, options);
	};

	var dateToDate = function(dt) {
		if (typeof dt === 'string') {
			return new Date(dt);
		}
		return dt;
	};

	DateTimePicker.prototype = {
		constructor : DateTimePicker,

		init : function(element, options) {
			var icon;
			if (!(options.pickTime || options.pickDate))
				throw new Error('Must choose at least one picker');
			this.options = options;
			this.$element = $(element);
			this.language = options.language in dates ? options.language : 'en'
			this.pickDate = options.pickDate;
			this.pickTime = options.pickTime;
			this.component = false;
			if (this.$element.find('.input-append').length
					|| this.$element.find('.input-prepend').length)
				this.component = this.$element.find('.add-on');
			this.format = options.format;
			if (!this.format) {
				this.format = this.$element.data('format');
				if (!this.format)
					this.format = 'MM/dd/yyyy';
			}
			if (this.component) {
				icon = this.component.find('i');
			}
			if (this.pickTime) {
				this.timeIcon = 'glyphicon glyphicon-time';
				if (icon && icon.length) {
					this.timeIcon = icon.data('time-icon') || this.timeIcon;
					icon.addClass(this.timeIcon);
				}
			}
			if (this.pickDate) {
				this.dateIcon = 'glyphicon glyphicon-calendar';
				if (icon && icon.length) {
					this.dateIcon = icon.data('date-icon') || this.dateIcon;
					icon.removeClass(this.timeIcon).addClass(this.dateIcon);
				}
			}
			this.widget = $(
					getTemplate(this.timeIcon, options.pickDate,
							options.pickTime, options.pick12HourFormat,
							options.pickSeconds, options.collapse)).appendTo(
					'body');
			this.minViewMode = options.minViewMode
					|| this.$element.data('date-minviewmode') || 0;
			if (typeof this.minViewMode === 'string') {
				switch (this.minViewMode) {
				case 'months':
					this.minViewMode = 1;
					break;
				case 'years':
					this.minViewMode = 2;
					break;
				default:
					this.minViewMode = 0;
					break;
				}
			}
			this.viewMode = options.viewMode
					|| this.$element.data('date-viewmode') || 0;
			if (typeof this.viewMode === 'string') {
				switch (this.viewMode) {
				case 'months':
					this.viewMode = 1;
					break;
				case 'years':
					this.viewMode = 2;
					break;
				default:
					this.viewMode = 0;
					break;
				}
			}
			this.startViewMode = this.viewMode;
			this.weekStart = options.weekStart
					|| this.$element.data('date-weekstart') || 0;
			this.weekEnd = this.weekStart === 0 ? 6 : this.weekStart - 1;
			this.setStartDate(options.startDate
					|| this.$element.data('date-startdate'));
			this.setEndDate(options.endDate
					|| this.$element.data('date-enddate'));
			this.fillDow();
			this.fillMonths();
			this.fillHours();
			this.fillMinutes();
			this.fillSeconds();
			this.update();
			this.showMode();
			this._attachDatePickerEvents();
		},

		show : function(e) {
			if(e && e.target)
				this.$element = $(e.target);
			this.widget.show();
			this.height = this.component ? this.component.outerHeight()
					: this.$element.outerHeight() + 5;
			this.place();
			this.$element.trigger({
				type : 'show',
				date : this._date
			});
			this._attachDatePickerGlobalEvents();
			if (e) {
				e.stopPropagation();
				e.preventDefault();
			}
		},

		disable : function() {
			this.$element.find('input').prop('disabled', true);
			this._detachDatePickerEvents();
		},
		enable : function() {
			this.$element.find('input').prop('disabled', false);
			this._attachDatePickerEvents();
		},

		hide : function() {
			// Ignore event if in the middle of a picker transition
			var collapse = this.widget.find('.collapse')
			for ( var i = 0; i < collapse.length; i++) {
				var collapseData = collapse.eq(i).data('collapse');
				if (collapseData && collapseData.transitioning)
					return;
			}
			this.widget.hide();
			this.viewMode = this.startViewMode;
			this.showMode();
			// this.set();
			this.$element.trigger({
				type : 'hide',
				date : this._date
			});
			this._detachDatePickerGlobalEvents();
		},

		set : function() {
			var formatted = '';
			if (!this._unset)
				formatted = this.formatDate(this._date);
			this.$element.val(formatted);
		},

		setValue : function(newDate) {
			if (!newDate) {
				this._unset = true;
			} else {
				this._unset = false;
			}
			if (typeof newDate === 'string') {
				this._date = this.parseDate(newDate);
			} else if (newDate) {
				this._date = new Date(newDate);
			}
			this.set();
			this.viewDate = new Date(this._date.getFullYear(), this._date
					.getMonth(), 1, 0, 0, 0, 0);
			this.fillDate();
			this.fillTime();
		},

		getDate : function() {
			if (this._unset)
				return null;
			return new Date(this._date.valueOf());
		},

		setDate : function(date) {
			if (!date)
				this.setValue(null);
			else
				this.setValue(date.valueOf());
		},

		setStartDate : function(date) {
			if (date instanceof Date) {
				this.startDate = date;
			} else if (typeof date === 'string') {
				this.startDate = new Date(date);
				if (!this.startDate.getFullYear()) {
					this.startDate = -Infinity;
				}
			} else {
				this.startDate = -Infinity;
			}
			if (this.viewDate) {
				this.update();
			}
		},

		setEndDate : function(date) {
			if (date instanceof Date) {
				this.endDate = date;
			} else if (typeof date === 'string') {
				this.endDate = new Date(date);
				if (!this.endDate.getFullYear()) {
					this.endDate = Infinity;
				}
			} else {
				this.endDate = Infinity;
			}
			if (this.viewDate) {
				this.update();
			}
		},

		place : function() {
			var position = 'absolute';
			var offset = this.component ? this.component.offset()
					: this.$element.offset();
			this.width = this.component ? this.component.outerWidth()
					: this.$element.outerWidth();
			if ($(document).height() - offset.top < 300){
				offset.top = offset.top - this.widget.height() - 18;
				this.widget.addClass('upon');
			}else{
				offset.top = offset.top + this.height;
				this.widget.removeClass('upon');
			}
			
			var $window = $(window);

			if (this.options.width != undefined) {
				this.widget.width(this.options.width);
			}

			if (this.options.orientation == 'left') {
				this.widget.addClass('left-oriented');
				offset.left = offset.left - this.widget.width() + 20;
			}

			if (this._isInFixed()) {
				position = 'fixed';
				offset.top -= $window.scrollTop();
				offset.left -= $window.scrollLeft();
			}

			if ($window.width() < offset.left + this.widget.outerWidth()) {
				offset.right = $window.width() - offset.left - this.width;
				offset.left = 'auto';
				this.widget.addClass('pull-right');
			} else {
				offset.right = 'auto';
				this.widget.removeClass('pull-right');
			}

			this.widget.css({
				position : position,
				top : offset.top,
				left : offset.left,
				right : offset.right
			});
		},

		notifyChange : function() {
			this.$element.trigger({
				type : 'changeDate',
				date : this.getDate()
			});
		},

		update : function(newDate) {
			var dateStr = newDate;
			if (!dateStr) {
				dateStr = this.$element.val();
				if (dateStr) {
					this._date = this.parseDate(dateStr);
				}
				if (!this._date) {
					var tmp = new Date()
					this._date = new Date(tmp.getFullYear(), tmp.getMonth(), tmp
							.getDate(), tmp.getHours(), tmp.getMinutes(), tmp
							.getSeconds(), tmp.getMilliseconds())
				}
			}
			this.viewDate = new Date(this._date.getFullYear(), this._date
					.getMonth(), 1, 0, 0, 0, 0);
			this.fillDate();
			this.fillTime();
		},

		fillDow : function() {
			var dowCnt = this.weekStart;
			var html = $('<tr>');
			while (dowCnt < this.weekStart + 7) {
				html.append('<th class="dow">'
						+ dates[this.language].daysMin[(dowCnt++) % 7]
						+ '</th>');
			}
			this.widget.find('.datepicker-days thead').append(html);
		},

		fillMonths : function() {
			var html = '';
			var i = 0
			while (i < 12) {
				html += '<span class="month">'
						+ dates[this.language].monthsShort[i++] + '</span>';
			}
			this.widget.find('.datepicker-months td').append(html);
		},

		fillDate : function() {
			var year = this.viewDate.getFullYear();
			var month = this.viewDate.getMonth();
			var currentDate = new Date(this._date.getFullYear(), this._date
					.getMonth(), this._date.getDate(), 0, 0, 0, 0);
			var startYear = typeof this.startDate === 'object' ? this.startDate
					.getFullYear() : -Infinity;
			var startMonth = typeof this.startDate === 'object' ? this.startDate
					.getMonth()
					: -1;
			var endYear = typeof this.endDate === 'object' ? this.endDate
					.getFullYear() : Infinity;
			var endMonth = typeof this.endDate === 'object' ? this.endDate
					.getMonth() : 12;

			this.widget.find('.datepicker-days').find('.disabled').removeClass(
					'disabled');
			this.widget.find('.datepicker-months').find('.disabled')
					.removeClass('disabled');
			this.widget.find('.datepicker-years').find('.disabled')
					.removeClass('disabled');

			this.widget.find('.datepicker-days th:eq(1)').text(
					dates[this.language].months[month] + ' ' + year);

			var prevMonth = new Date(year, month - 1, 28, 0, 0, 0, 0);
			var day = DPGlobal.getDaysInMonth(prevMonth.getFullYear(),
					prevMonth.getMonth());
			prevMonth.setDate(day);
			prevMonth.setDate(day
					- (prevMonth.getDay() - this.weekStart + 7) % 7);
			if ((year == startYear && month <= startMonth) || year < startYear) {
				this.widget.find('.datepicker-days th:eq(0)').addClass(
						'disabled');
			}
			if ((year == endYear && month >= endMonth) || year > endYear) {
				this.widget.find('.datepicker-days th:eq(2)').addClass(
						'disabled');
			}

			var nextMonth = new Date(prevMonth.valueOf());
			nextMonth.setDate(nextMonth.getDate() + 42);
			nextMonth = nextMonth.valueOf();
			var html = [];
			var row;
			var clsName;
			while (prevMonth.valueOf() < nextMonth) {
				if (prevMonth.getDay() === this.weekStart) {
					row = $('<tr>');
					html.push(row);
				}
				clsName = '';
				if (prevMonth.getFullYear() < year
						|| (prevMonth.getFullYear() == year && prevMonth
								.getMonth() < month)) {
					clsName += ' old';
				} else if (prevMonth.getFullYear() > year
						|| (prevMonth.getFullYear() == year && prevMonth
								.getMonth() > month)) {
					clsName += ' new';
				}
				if (prevMonth.valueOf() === currentDate.valueOf()) {
					clsName += ' active';
				}
				if ((prevMonth.valueOf() + 86400000) <= this.startDate) {
					clsName += ' disabled';
				}
				if (prevMonth.valueOf() > this.endDate) {
					clsName += ' disabled';
				}
				row.append('<td class="day' + clsName + '">'
						+ prevMonth.getDate() + '</td>');
				prevMonth.setDate(prevMonth.getDate() + 1);
			}
			this.widget.find('.datepicker-days tbody').empty().append(html);
			var currentYear = this._date.getFullYear();

			var months = this.widget.find('.datepicker-months')
					.find('th:eq(1)').text(year).end().find('span')
					.removeClass('active');
			if (currentYear === year) {
				months.eq(this._date.getMonth()).addClass('active');
			}
			if (currentYear - 1 < startYear) {
				this.widget.find('.datepicker-months th:eq(0)').addClass(
						'disabled');
			}
			if (currentYear + 1 > endYear) {
				this.widget.find('.datepicker-months th:eq(2)').addClass(
						'disabled');
			}
			for ( var i = 0; i < 12; i++) {
				if ((year == startYear && startMonth > i) || (year < startYear)) {
					$(months[i]).addClass('disabled');
				} else if ((year == endYear && endMonth < i)
						|| (year > endYear)) {
					$(months[i]).addClass('disabled');
				}
			}

			html = '';
			year = parseInt(year / 10, 10) * 10;
			var yearCont = this.widget.find('.datepicker-years').find(
					'th:eq(1)').text(year + '-' + (year + 9)).end().find('td');
			this.widget.find('.datepicker-years').find('th').removeClass(
					'disabled');
			if (startYear > year) {
				this.widget.find('.datepicker-years').find('th:eq(0)')
						.addClass('disabled');
			}
			if (endYear < year + 9) {
				this.widget.find('.datepicker-years').find('th:eq(2)')
						.addClass('disabled');
			}
			year -= 1;
			for ( var i = -1; i < 11; i++) {
				html += '<span class="year'
						+ (i === -1 || i === 10 ? ' old' : '')
						+ (currentYear === year ? ' active' : '')
						+ ((year < startYear || year > endYear) ? ' disabled'
								: '') + '">' + year + '</span>';
				year += 1;
			}
			yearCont.html(html);
		},

		fillHours : function() {
			var table = this.widget.find('.timepicker .timepicker-hours table');
			table.parent().hide();
			var html = '';
			if (this.options.pick12HourFormat) {
				var current = 1;
				for ( var i = 0; i < 3; i += 1) {
					html += '<tr>';
					for ( var j = 0; j < 4; j += 1) {
						var c = current.toString();
						html += '<td class="hour">' + padLeft(c, 2, '0')
								+ '</td>';
						current++;
					}
					html += '</tr>'
				}
			} else {
				var current = 0;
				for ( var i = 0; i < 6; i += 1) {
					html += '<tr>';
					for ( var j = 0; j < 4; j += 1) {
						var c = current.toString();
						html += '<td class="hour">' + padLeft(c, 2, '0')
								+ '</td>';
						current++;
					}
					html += '</tr>'
				}
			}
			table.html(html);
		},

		fillMinutes : function() {
			var table = this.widget
					.find('.timepicker .timepicker-minutes table');
			table.parent().hide();
			var html = '';
			var current = 0;
			for ( var i = 0; i < 5; i++) {
				html += '<tr>';
				for ( var j = 0; j < 4; j += 1) {
					var c = current.toString();
					html += '<td class="minute">' + padLeft(c, 2, '0')
							+ '</td>';
					current += 3;
				}
				html += '</tr>';
			}
			table.html(html);
		},

		fillSeconds : function() {
			var table = this.widget
					.find('.timepicker .timepicker-seconds table');
			table.parent().hide();
			var html = '';
			var current = 0;
			for ( var i = 0; i < 5; i++) {
				html += '<tr>';
				for ( var j = 0; j < 4; j += 1) {
					var c = current.toString();
					html += '<td class="second">' + padLeft(c, 2, '0')
							+ '</td>';
					current += 3;
				}
				html += '</tr>';
			}
			table.html(html);
		},

		fillTime : function() {
			if (!this._date)
				return;
			var timeComponents = this.widget
					.find('.timepicker span[data-time-component]');
			var table = timeComponents.closest('table');
			var is12HourFormat = this.options.pick12HourFormat;
			var hour = this._date.getHours();
			var period = 'AM';
			if (is12HourFormat) {
				if (hour >= 12)
					period = 'PM';
				if (hour === 0)
					hour = 12;
				else if (hour != 12)
					hour = hour % 12;
				this.widget.find('.timepicker [data-action=togglePeriod]')
						.text(period);
			}
			hour = padLeft(hour.toString(), 2, '0');
			var minute = padLeft(this._date.getMinutes().toString(), 2, '0');
			var second = padLeft(this._date.getSeconds().toString(), 2, '0');
			timeComponents.filter('[data-time-component=hours]').text(hour);
			timeComponents.filter('[data-time-component=minutes]').text(minute);
			timeComponents.filter('[data-time-component=seconds]').text(second);
		},

		click : function(e) {
			e.stopPropagation();
			e.preventDefault();
			this._unset = false;
			var target = $(e.target).closest('span, td, th');
			if (target.length === 1) {
				if (!target.is('.disabled')) {
					switch (target[0].nodeName.toLowerCase()) {
					case 'th':
						switch (target[0].className) {
						case 'switch':
							this.showMode(1);
							break;
						case 'prev':
						case 'next':
							var vd = this.viewDate;
							var navFnc = DPGlobal.modes[this.viewMode].navFnc;
							var step = DPGlobal.modes[this.viewMode].navStep;
							if (target[0].className === 'prev')
								step = step * -1;
							vd['set' + navFnc](vd['get' + navFnc]() + step);
							this.fillDate();
							this.set();
							break;
						}
						break;
					case 'span':
						if (target.is('.month')) {
							var month = target.parent().find('span').index(
									target);
							this.viewDate.setMonth(month);
						} else {
							var year = parseInt(target.text(), 10) || 0;
							this.viewDate.setFullYear(year);
						}
						if (this.viewMode !== 0) {
							this._date = new Date(
									this.viewDate.getFullYear(),
									this.viewDate.getMonth(), this.viewDate
											.getDate(), this._date
											.getHours(), this._date
											.getMinutes(), this._date
											.getSeconds(), this._date
											.getMilliseconds());
							this.notifyChange();
						}
						this.showMode(-1);
						this.fillDate();
						this.set();
						break;
					case 'td':
						if (target.is('.day')) {
							var day = parseInt(target.text(), 10) || 1;
							var month = this.viewDate.getMonth();
							var year = this.viewDate.getFullYear();
							if (target.is('.old')) {
								if (month === 0) {
									month = 11;
									year -= 1;
								} else {
									month -= 1;
								}
							} else if (target.is('.new')) {
								if (month == 11) {
									month = 0;
									year += 1;
								} else {
									month += 1;
								}
							}
							this._date = new Date(year, month, day, this._date
									.getHours(), this._date.getMinutes(),
									this._date.getSeconds(), this._date
											.getMilliseconds());
							this.viewDate = new Date(year, month, Math.min(28,
									day), 0, 0, 0, 0);
							this.fillDate();
							this.set();
							this.notifyChange();
						}
						break;
					}
				}
			}
		},

		actions : {
			incrementHours : function(e) {
				this._date.setHours(this._date.getHours() + 1);
			},

			incrementMinutes : function(e) {
				this._date.setMinutes(this._date.getMinutes() + 1);
			},

			incrementSeconds : function(e) {
				this._date.setSeconds(this._date.getSeconds() + 1);
			},

			decrementHours : function(e) {
				this._date.setHours(this._date.getHours() - 1);
			},

			decrementMinutes : function(e) {
				this._date.setMinutes(this._date.getMinutes() - 1);
			},

			decrementSeconds : function(e) {
				this._date.setSeconds(this._date.getSeconds() - 1);
			},

			togglePeriod : function(e) {
				var hour = this._date.getHours();
				if (hour >= 12)
					hour -= 12;
				else
					hour += 12;
				this._date.setHours(hour);
			},

			showPicker : function() {
				this.widget.find('.timepicker > div:not(.timepicker-picker)')
						.hide();
				this.widget.find('.timepicker .timepicker-picker').show();
			},

			showHours : function() {
				this.widget.find('.timepicker .timepicker-picker').hide();
				this.widget.find('.timepicker .timepicker-hours').show();
			},

			showMinutes : function() {
				this.widget.find('.timepicker .timepicker-picker').hide();
				this.widget.find('.timepicker .timepicker-minutes').show();
			},

			showSeconds : function() {
				this.widget.find('.timepicker .timepicker-picker').hide();
				this.widget.find('.timepicker .timepicker-seconds').show();
			},

			selectHour : function(e) {
				var tgt = $(e.target);
				var value = parseInt(tgt.text(), 10);
				if (this.options.pick12HourFormat) {
					var current = this._date.getHours();
					if (current >= 12) {
						if (value != 12)
							value = (value + 12) % 24;
					} else {
						if (value === 12)
							value = 0;
						else
							value = value % 12;
					}
				}
				this._date.setHours(value);
				this.actions.showPicker.call(this);
			},

			selectMinute : function(e) {
				var tgt = $(e.target);
				var value = parseInt(tgt.text(), 10);
				this._date.setMinutes(value);
				this.actions.showPicker.call(this);
			},

			selectSecond : function(e) {
				var tgt = $(e.target);
				var value = parseInt(tgt.text(), 10);
				this._date.setSeconds(value);
				this.actions.showPicker.call(this);
			}
		},

		doAction : function(e) {
			e.stopPropagation();
			e.preventDefault();
			if (!this._date)
				this._date = new Date(1970, 0, 0, 0, 0, 0, 0);
			var action = $(e.currentTarget).data('action');
			var rv = this.actions[action].apply(this, arguments);
			this.set();
			this.fillTime();
			this.notifyChange();
			return rv;
		},

		stopEvent : function(e) {
			e.stopPropagation();
			e.preventDefault();
		},

		change : function(e) {
			if(e && e.target)
				this.$element = $(e.target);
			var input = $(e.target);
			var val = input.val();
			if (val) {
				this.update();
				this.setValue(this._date.getTime());
				this.notifyChange();
				this.set();
			} else if (val && val.trim()) {
				this.setValue(this._date.getTime());
				if (this._date)
					this.set();
				else
					input.val('');
			} else {
				if (this._date) {
					this.setValue(null);
					// unset the date when the input is
					// erased
					this.notifyChange();
					this._unset = true;
				}
			}
		},

		showMode : function(dir) {
			if (dir) {
				this.viewMode = Math.max(this.minViewMode, Math.min(2,
						this.viewMode + dir));
			}
			this.widget.find('.datepicker > div').hide().filter(
					'.datepicker-' + DPGlobal.modes[this.viewMode].clsName)
					.show();
		},

		destroy : function() {
			this._detachDatePickerEvents();
			this._detachDatePickerGlobalEvents();
			this.widget.remove();
			this.$element.removeData('datetimepicker');
			this.component.removeData('datetimepicker');
		},

		formatDate : function(d) {
			return $.format.date(d, this.format);
		},

		parseDate : function(str) {
			return $.format.date(str, this.format);
		},

		_attachDatePickerEvents : function() {
			var self = this;
			// this handles date picker clicks
			this.widget.on('click', '.datepicker *', $.proxy(this.click, this));
			// this handles time picker clicks
			this.widget.on('click', '[data-action]', $.proxy(this.doAction,
					this));
			this.widget.on('mousedown', $.proxy(this.stopEvent, this));
			if (this.pickDate && this.pickTime) {
				this.widget.on('click.togglePicker', '.accordion-toggle',
						function(e) {
							e.stopPropagation();
							var $this = $(this);
							var $parent = $this.closest('ul');
							var expanded = $parent.find('.collapse.in');
							var closed = $parent.find('.collapse:not(.in)');

							if (expanded && expanded.length) {
								var collapseData = expanded.data('collapse');
								if (collapseData && collapseData.transitioning)
									return;
								expanded.collapse('hide');
								closed.collapse('show')
								$this.find('i').toggleClass(
										self.timeIcon + ' ' + self.dateIcon);
								self.$element.find('.add-on i').toggleClass(
										self.timeIcon + ' ' + self.dateIcon);
							}
						});
			}
			this.$element.on({
				'focus' : $.proxy(this.show, this),
				'change' : $.proxy(this.change, this)
			});
		},

		_attachDatePickerGlobalEvents : function() {
			$(window).on('resize.datetimepicker' + this.id,
					$.proxy(this.place, this));
			$(document).on('mousedown.datetimepicker' + this.id,
					$.proxy(this.hide, this));
		},

		_detachDatePickerEvents : function() {
			this.widget.off('click', '.datepicker *', this.click);
			this.widget.off('click', '[data-action]');
			this.widget.off('mousedown', this.stopEvent);
			if (this.pickDate && this.pickTime) {
				this.widget.off('click.togglePicker');
			}
			this.$element.off({
				'focus' : this.show,
				'change' : this.change
			});
		},

		_detachDatePickerGlobalEvents : function() {
			$(window).off('resize.datetimepicker' + this.id);
			$(document).off('mousedown.datetimepicker' + this.id);
		},

		_isInFixed : function() {
			if (this.$element) {
				var parents = this.$element.parents();
				var inFixed = false;
				for ( var i = 0; i < parents.length; i++) {
					if ($(parents[i]).css('position') == 'fixed') {
						inFixed = true;
						break;
					}
				}
				;
				return inFixed;
			} else {
				return false;
			}
		}
	};

	$.fn.datetimepicker = function(option, val) {
		return this
				.each(function() {
					var $this = $(this), data = $this.data('datetimepicker'), options = typeof option === 'object'
							&& option;
					if (!data) {
						$this
								.data(
										'datetimepicker',
										(data = new DateTimePicker(
												this,
												$
														.extend(
																{},
																$.fn.datetimepicker.defaults,
																options))));
					}
					if (typeof option === 'string')
						data[option](val);
				});
	};

	$.fn.datetimepicker.defaults = {
		pickDate : true,
		pickTime : true,
		pick12HourFormat : false,
		pickSeconds : true,
		startDate : -Infinity,
		endDate : Infinity,
		collapse : true
	};
	$.fn.datetimepicker.Constructor = DateTimePicker;
	var dpgId = 0;
	var dates = $.fn.datetimepicker.dates = {
		en : {
			days : [ "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday",
					"Friday", "Saturday", "Sunday" ],
			daysShort : [ "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat",
					"Sun" ],
			daysMin : [ "Su", "Mo", "Tu", "We", "Th", "Fr", "Sa", "Su" ],
			months : [ "January", "February", "March", "April", "May", "June",
					"July", "August", "September", "October", "November",
					"December" ],
			monthsShort : [ "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul",
					"Aug", "Sep", "Oct", "Nov", "Dec" ]
		}
	};

	function padLeft(s, l, c) {
		if (l < s.length)
			return s;
		else
			return Array(l - s.length + 1).join(c || ' ') + s;
	}

	function getTemplate(timeIcon, pickDate, pickTime, is12Hours, showSeconds,
			collapse) {
		if (pickDate && pickTime) {
			return ('<div class="bootstrap-datetimepicker-widget dropdown-menu">'
					+ '<ul>'
					+ '<li'
					+ (collapse ? ' class="collapse in"' : '')
					+ '>'
					+ '<div class="datepicker">'
					+ DPGlobal.template
					+ '</div>'
					+ '</li>'
					+ '<li class="picker-switch accordion-toggle"><a><i class="'
					+ timeIcon
					+ '"></i></a></li>'
					+ '<li'
					+ (collapse ? ' class="collapse"' : '')
					+ '>'
					+ '<div class="timepicker">'
					+ TPGlobal.getTemplate(is12Hours, showSeconds)
					+ '</div>'
					+ '</li>' + '</ul>' + '</div>');
		} else if (pickTime) {
			return ('<div class="bootstrap-datetimepicker-widget dropdown-menu">'
					+ '<div class="timepicker">'
					+ TPGlobal.getTemplate(is12Hours, showSeconds) + '</div>' + '</div>');
		} else {
			return ('<div class="bootstrap-datetimepicker-widget dropdown-menu">'
					+ '<div class="datepicker">' + DPGlobal.template + '</div>' + '</div>');
		}
	}


	var DPGlobal = {
		modes : [ {
			clsName : 'days',
			navFnc : 'Month',
			navStep : 1
		}, {
			clsName : 'months',
			navFnc : 'FullYear',
			navStep : 1
		}, {
			clsName : 'years',
			navFnc : 'FullYear',
			navStep : 10
		} ],
		isLeapYear : function(year) {
			return (((year % 4 === 0) && (year % 100 !== 0)) || (year % 400 === 0))
		},
		getDaysInMonth : function(year, month) {
			return [ 31, (DPGlobal.isLeapYear(year) ? 29 : 28), 31, 30, 31, 30,
					31, 31, 30, 31, 30, 31 ][month]
		},
		headTemplate : '<thead>' + '<tr>' + '<th class="prev">&lsaquo;</th>'
				+ '<th colspan="5" class="switch"></th>'
				+ '<th class="next">&rsaquo;</th>' + '</tr>' + '</thead>',
		contTemplate : '<tbody><tr><td colspan="7"></td></tr></tbody>'
	};
	DPGlobal.template = '<div class="datepicker-days">'
			+ '<table class="table-condensed">' + DPGlobal.headTemplate
			+ '<tbody></tbody>' + '</table>' + '</div>'
			+ '<div class="datepicker-months">'
			+ '<table class="table-condensed">' + DPGlobal.headTemplate
			+ DPGlobal.contTemplate + '</table>' + '</div>'
			+ '<div class="datepicker-years">'
			+ '<table class="table-condensed">' + DPGlobal.headTemplate
			+ DPGlobal.contTemplate + '</table>' + '</div>';
	var TPGlobal = {
		hourTemplate : '<span data-action="showHours" data-time-component="hours" class="timepicker-hour"></span>',
		minuteTemplate : '<span data-action="showMinutes" data-time-component="minutes" class="timepicker-minute"></span>',
		secondTemplate : '<span data-action="showSeconds" data-time-component="seconds" class="timepicker-second"></span>'
	};
	TPGlobal.getTemplate = function(is12Hours, showSeconds) {
		return ('<div class="timepicker-picker">'
				+ '<table class="table-condensed"'
				+ (is12Hours ? ' data-hour-format="12"' : '')
				+ '>'
				+ '<tr>'
				+ '<td><a href="#" class="btn" data-action="incrementHours"><i class="glyphicon glyphicon-chevron-up"></i></a></td>'
				+ '<td class="separator"></td>'
				+ '<td><a href="#" class="btn" data-action="incrementMinutes"><i class="glyphicon glyphicon-chevron-up"></i></a></td>'
				+ (showSeconds ? '<td class="separator"></td>'
						+ '<td><a href="#" class="btn" data-action="incrementSeconds"><i class="glyphicon glyphicon-chevron-up"></i></a></td>'
						: '')
				+ (is12Hours ? '<td class="separator"></td>' : '')
				+ '</tr>'
				+ '<tr>'
				+ '<td>'
				+ TPGlobal.hourTemplate
				+ '</td> '
				+ '<td class="separator">:</td>'
				+ '<td>'
				+ TPGlobal.minuteTemplate
				+ '</td> '
				+ (showSeconds ? '<td class="separator">:</td>' + '<td>'
						+ TPGlobal.secondTemplate + '</td>' : '')
				+ (is12Hours ? '<td class="separator"></td>'
						+ '<td>'
						+ '<button type="button" class="btn btn-primary" data-action="togglePeriod"></button>'
						+ '</td>'
						: '')
				+ '</tr>'
				+ '<tr>'
				+ '<td><a href="#" class="btn" data-action="decrementHours"><i class="glyphicon glyphicon-chevron-down"></i></a></td>'
				+ '<td class="separator"></td>'
				+ '<td><a href="#" class="btn" data-action="decrementMinutes"><i class="glyphicon glyphicon-chevron-down"></i></a></td>'
				+ (showSeconds ? '<td class="separator"></td>'
						+ '<td><a href="#" class="btn" data-action="decrementSeconds"><i class="glyphicon glyphicon-chevron-down"></i></a></td>'
						: '')
				+ (is12Hours ? '<td class="separator"></td>' : '')
				+ '</tr>'
				+ '</table>'
				+ '</div>'
				+ '<div class="timepicker-hours" data-action="selectHour">'
				+ '<table class="table-condensed">'
				+ '</table>'
				+ '</div>'
				+ '<div class="timepicker-minutes" data-action="selectMinute">'
				+ '<table class="table-condensed">' + '</table>' + '</div>' + (showSeconds ? '<div class="timepicker-seconds" data-action="selectSecond">'
				+ '<table class="table-condensed">' + '</table>' + '</div>'
				: ''));
	}

})(window.jQuery)