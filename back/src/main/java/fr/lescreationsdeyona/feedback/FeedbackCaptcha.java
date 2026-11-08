package fr.lescreationsdeyona.feedback;

import io.swagger.v3.oas.annotations.media.Schema;

/** What the browser needs to show Google's "Je ne suis pas un robot". */
public record FeedbackCaptcha(@Schema(description = "Public key of the reCAPTCHA v2 checkbox") String siteKey) {
}
