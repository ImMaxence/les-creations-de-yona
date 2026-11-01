package fr.lescreationsdeyona.stats;

import io.swagger.v3.oas.annotations.media.Schema;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Visits coming from an AI assistant (a link in an answer of ChatGPT, Perplexity…): how often the
 * site is cited. One count per day (Paris time) and per assistant, nothing about the visitor; a
 * day is erased after 13 months.
 */
@Service
@RequiredArgsConstructor
public class AiVisitService {

	private static final String TODAY = "(now() at time zone 'Europe/Paris')::date";

	private final JdbcClient jdbc;

	public record AiVisits(AiAssistant assistant, @Schema(description = "The last 30 days, today included") long last30Days,
			@Schema(description = "The last 12 months") long last12Months) {
	}

	@Transactional
	public void record(AiAssistant assistant) {
		jdbc.sql("delete from ai_visit where day < " + TODAY + " - interval '13 months'").update();
		jdbc.sql("insert into ai_visit (day, assistant, count) values (" + TODAY + """
				, :assistant, 1)
				on conflict (day, assistant) do update set count = ai_visit.count + 1""")
			.param("assistant", assistant.name())
			.update();
	}

	/** Assistants that sent visitors these 12 months, the most first. */
	@Transactional(readOnly = true)
	public List<AiVisits> summary() {
		return jdbc.sql("""
				select assistant, coalesce(sum(count) filter (where day > %1$s - 30), 0) as last_30_days,
					sum(count) as last_12_months
				from ai_visit where day > %1$s - interval '12 months'
				group by assistant order by last_12_months desc, assistant""".formatted(TODAY))
			.query((row, index) -> new AiVisits(AiAssistant.valueOf(row.getString("assistant")), row.getLong("last_30_days"),
					row.getLong("last_12_months")))
			.list();
	}

}
