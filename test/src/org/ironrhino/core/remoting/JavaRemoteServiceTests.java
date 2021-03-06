package org.ironrhino.core.remoting;

import org.junit.runner.RunWith;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.junit4.SpringRunner;

@RunWith(SpringRunner.class)
@ContextConfiguration(classes = RemotingConfiguration.class)
@TestPropertySource(properties = "httpInvoker.serialization.type=JAVA")
public class JavaRemoteServiceTests extends RemoteServiceTestsBase {

}