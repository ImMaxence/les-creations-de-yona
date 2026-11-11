package fr.lescreationsdeyona.monitoring;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.LoggingEvent;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class ProblemAppenderTest {

	private final List<LoggedProblem> caught = new ArrayList<>();

	private final ProblemAppender appender = new ProblemAppender(caught::add);

	private final LoggerContext context = new LoggerContext();

	private void log(String loggerName, Level level, String message, Throwable thrown, Object... arguments) {
		Logger logger = context.getLogger(loggerName);
		appender.doAppend(new LoggingEvent(Logger.class.getName(), logger, level, message, thrown, arguments));
	}

	{
		appender.setContext(context);
		appender.start();
	}

	@Test
	void catchesWarningsAndErrorsWithTheirStackTrace() {
		log("fr.lescreationsdeyona.ai.Gemini", Level.INFO, "Ready", null);
		log("fr.lescreationsdeyona.ai.Gemini", Level.WARN, "Gemini {}: {}", null, "flash", "HTTP 503");
		log("fr.lescreationsdeyona.backup.BackupService", Level.ERROR, "Backup failed", new IllegalStateException("disk full"));

		assertThat(caught).hasSize(2);
		assertThat(caught.get(0).level()).isEqualTo(LoggedProblem.Level.WARN);
		assertThat(caught.get(0).message()).isEqualTo("Gemini flash: HTTP 503");
		assertThat(caught.get(0).detail()).isNull();
		assertThat(caught.get(1).level()).isEqualTo(LoggedProblem.Level.ERROR);
		assertThat(caught.get(1).source()).isEqualTo(LoggedProblem.Source.BACKEND);
		assertThat(caught.get(1).logger()).isEqualTo("fr.lescreationsdeyona.backup.BackupService");
		assertThat(caught.get(1).detail()).contains("java.lang.IllegalStateException: disk full", "ProblemAppenderTest");
	}

	@Test
	void groupsTheSameLineOfCodeWithOtherValues() {
		log("fr.lescreationsdeyona.ai.Gemini", Level.WARN, "Gemini {}: {}", null, "flash", "HTTP 503");
		log("fr.lescreationsdeyona.ai.Gemini", Level.WARN, "Gemini {}: {}", null, "flash-lite", "timeout");
		log("fr.lescreationsdeyona.ai.Gemini", Level.WARN, "Key refused", null);

		assertThat(caught.get(0).fingerprint()).isEqualTo(caught.get(1).fingerprint());
		assertThat(caught.get(2).fingerprint()).isNotEqualTo(caught.get(0).fingerprint());
	}

	@Test
	void leavesItsOwnMessagesOut() {
		log(ErrorLog.class.getName(), Level.WARN, "Error log not written", null);

		assertThat(caught).isEmpty();
	}

	@Test
	void namesAnExceptionWithoutMessage() {
		log("fr.lescreationsdeyona.Web", Level.ERROR, "", new NullPointerException("value"));

		assertThat(caught.getFirst().message()).isEqualTo("java.lang.NullPointerException: value");
	}

}
