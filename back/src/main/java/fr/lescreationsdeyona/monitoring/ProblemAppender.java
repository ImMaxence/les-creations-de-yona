package fr.lescreationsdeyona.monitoring;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.IThrowableProxy;
import ch.qos.logback.classic.spi.StackTraceElementProxy;
import ch.qos.logback.classic.spi.ThrowableProxyUtil;
import ch.qos.logback.core.AppenderBase;
import java.time.Instant;
import java.util.function.Consumer;

/**
 * Every warning and error the backend logs, handed to the error log (Journaux) as it happens: kept
 * in memory, written to the database a moment later. Only the message, the logger and the stack
 * trace: never the arguments' objects, nothing of the request.
 */
class ProblemAppender extends AppenderBase<ILoggingEvent> {

	/** Its own messages (a database out of reach) would feed it again. */
	static final String OWN_LOGGERS = ProblemAppender.class.getPackageName();

	private final Consumer<LoggedProblem> sink;

	ProblemAppender(Consumer<LoggedProblem> sink) {
		this.sink = sink;
		setName("error-log");
	}

	@Override
	protected void append(ILoggingEvent event) {
		if (!event.getLevel().isGreaterOrEqual(Level.WARN) || event.getLoggerName().startsWith(OWN_LOGGERS)) {
			return;
		}
		IThrowableProxy thrown = event.getThrowableProxy();
		LoggedProblem.Level level = event.getLevel().isGreaterOrEqual(Level.ERROR) ? LoggedProblem.Level.ERROR : LoggedProblem.Level.WARN;
		// The same line of code with other values is the same problem: "Gemini {}: {}" for every model
		String sameAs = event.getLoggerName() + "|" + event.getMessage() + "|" + origin(thrown);
		sink.accept(LoggedProblem.of(level, LoggedProblem.Source.BACKEND, event.getLoggerName(), message(event, thrown),
				thrown == null ? null : ThrowableProxyUtil.asString(thrown), null, sameAs, Instant.ofEpochMilli(event.getTimeStamp())));
	}

	/** The message, or the exception's when it has none. */
	private static String message(ILoggingEvent event, IThrowableProxy thrown) {
		String message = event.getFormattedMessage();
		if ((message == null || message.isBlank()) && thrown != null) {
			return thrown.getClassName() + ": " + thrown.getMessage();
		}
		return message == null ? "" : message;
	}

	/** Where the exception comes from: its class and its first line of code. */
	private static String origin(IThrowableProxy thrown) {
		if (thrown == null) {
			return "";
		}
		StackTraceElementProxy[] frames = thrown.getStackTraceElementProxyArray();
		return thrown.getClassName() + (frames.length > 0 ? "@" + frames[0].getStackTraceElement() : "");
	}

}
