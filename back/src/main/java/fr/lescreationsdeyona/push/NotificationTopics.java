package fr.lescreationsdeyona.push;

import io.swagger.v3.oas.annotations.media.Schema;

/** What a visitor's device is told of (2.24, "Mes notifications"): both false for a device that is told of nothing. */
public record NotificationTopics(@Schema(description = "Each recipe published for the first time") boolean recipes,
		@Schema(description = "Each article of \"Mon CAP\" published for the first time") boolean articles) {

	public static final NotificationTopics NONE = new NotificationTopics(false, false);

	boolean any() {
		return recipes || articles;
	}

}
