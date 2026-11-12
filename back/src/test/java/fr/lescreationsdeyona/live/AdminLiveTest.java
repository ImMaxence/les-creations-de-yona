package fr.lescreationsdeyona.live;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import fr.lescreationsdeyona.shop.OrderReceived;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.oidc.user.OidcUser;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

class AdminLiveTest {

	/** Group 12 holds Yona and Maxence; Léa is in no group. */
	private static final TypingRelay GROUPS = (group, writer, name) -> group == 12 && !writer.equals("lea@site.fr")
			? Set.of("yona@site.fr", "maxence@site.fr")
			: Set.of();

	private final AdminLive live = new AdminLive(provider(GROUPS));

	@SuppressWarnings("unchecked")
	private static ObjectProvider<TypingRelay> provider(TypingRelay relay) {
		ObjectProvider<TypingRelay> provider = mock(ObjectProvider.class);
		when(provider.getIfAvailable()).thenReturn(relay);
		return provider;
	}

	private static WebSocketSession open(String id) {
		WebSocketSession session = mock(WebSocketSession.class);
		when(session.getId()).thenReturn(id);
		when(session.isOpen()).thenReturn(true);
		return session;
	}

	/** A page open for an admin signed in with Google. */
	private static WebSocketSession openFor(String id, String email, String name) {
		WebSocketSession session = open(id);
		OidcUser user = mock(OidcUser.class);
		when(user.getEmail()).thenReturn(email);
		when(user.getFullName()).thenReturn(name);
		Authentication authentication = mock(Authentication.class);
		when(authentication.getPrincipal()).thenReturn(user);
		when(session.getPrincipal()).thenReturn(authentication);
		return session;
	}

	@Test
	void tellsTheMembersOfAGroupOnly() throws IOException {
		WebSocketSession yona = openFor("1", "Yona@site.fr", "Yona");
		WebSocketSession lea = openFor("2", "lea@site.fr", "Léa");
		live.afterConnectionEstablished(yona);
		live.afterConnectionEstablished(lea);

		live.onChange(new LiveChange(LiveTopic.MESSAGES, Set.of("yona@site.fr", "maxence@site.fr")));

		verify(yona).sendMessage(new TextMessage("{\"topic\":\"MESSAGES\"}"));
		verify(lea, never()).sendMessage(any());
	}

	@Test
	void tellsTheOtherMembersThatAnAdminIsWriting() throws IOException {
		WebSocketSession yona = openFor("1", "yona@site.fr", "Yona \"la cheffe\"");
		WebSocketSession maxence = openFor("2", "maxence@site.fr", "Maxence");
		WebSocketSession lea = openFor("3", "lea@site.fr", "Léa");
		live.afterConnectionEstablished(yona);
		live.afterConnectionEstablished(maxence);
		live.afterConnectionEstablished(lea);

		live.handleTextMessage(yona, new TextMessage("{\"typing\":12}"));

		verify(maxence).sendMessage(
				new TextMessage("{\"topic\":\"TYPING\",\"group\":12,\"email\":\"yona@site.fr\",\"name\":\"Yona \\\"la cheffe\\\"\"}"));
		verify(yona, never()).sendMessage(any());
		verify(lea, never()).sendMessage(any());
	}

	@Test
	void saysSoAtMostEveryFewSecondsAndOnlyForItsGroups() throws IOException {
		WebSocketSession yona = openFor("1", "yona@site.fr", "Yona");
		WebSocketSession maxence = openFor("2", "maxence@site.fr", "Maxence");
		WebSocketSession lea = openFor("3", "lea@site.fr", "Léa");
		live.afterConnectionEstablished(yona);
		live.afterConnectionEstablished(maxence);
		live.afterConnectionEstablished(lea);

		live.handleTextMessage(yona, new TextMessage("{\"typing\":12}"));
		live.handleTextMessage(yona, new TextMessage("{\"typing\":12}"));
		live.handleTextMessage(lea, new TextMessage("{\"typing\":12}"));
		live.handleTextMessage(maxence, new TextMessage("{\"typing\":99}"));
		live.handleTextMessage(maxence, new TextMessage("n'importe quoi"));

		verify(maxence).sendMessage(any());
		verify(yona, never()).sendMessage(any());
	}

	@Test
	void ignoresAPageWithoutAnAdminSignedIn() throws IOException {
		WebSocketSession anonymous = open("1");
		WebSocketSession maxence = openFor("2", "maxence@site.fr", "Maxence");
		live.afterConnectionEstablished(anonymous);
		live.afterConnectionEstablished(maxence);

		live.handleTextMessage(anonymous, new TextMessage("{\"typing\":12}"));
		live.onChange(new LiveChange(LiveTopic.MESSAGES, Set.of("maxence@site.fr")));

		verify(anonymous, never()).sendMessage(any());
		verify(maxence).sendMessage(new TextMessage("{\"topic\":\"MESSAGES\"}"));
	}

	@Test
	void writesNamesAsJsonStrings() {
		assertThat(AdminLive.json("a\"b\\c\nd")).isEqualTo("\"a\\\"b\\\\c\\u000ad\"");
	}

	@Test
	void tellsEveryPageOpenWhatChanged() throws IOException {
		WebSocketSession yona = open("1");
		WebSocketSession maxence = open("2");
		live.afterConnectionEstablished(yona);
		live.afterConnectionEstablished(maxence);

		live.onChange(new LiveChange(LiveTopic.TRASH));

		verify(yona).sendMessage(new TextMessage("{\"topic\":\"TRASH\"}"));
		verify(maxence).sendMessage(new TextMessage("{\"topic\":\"TRASH\"}"));
	}

	@Test
	void tellsANewOrder() throws IOException {
		WebSocketSession yona = open("1");
		live.afterConnectionEstablished(yona);

		live.onOrderReceived(new OrderReceived(12, 2, new BigDecimal("24.00")));

		verify(yona).sendMessage(new TextMessage("{\"topic\":\"ORDERS\"}"));
	}

	@Test
	void forgetsAPageClosed() throws IOException {
		WebSocketSession yona = open("1");
		live.afterConnectionEstablished(yona);

		live.afterConnectionClosed(yona, CloseStatus.NORMAL);
		live.onChange(new LiveChange(LiveTopic.HISTORY));

		assertThat(live.connections()).isZero();
		verify(yona, never()).sendMessage(any());
	}

	@Test
	void dropsAConnectionGoneWithoutSayingSo() throws IOException {
		WebSocketSession asleep = open("1");
		doThrow(new IOException("Broken pipe")).when(asleep).sendMessage(any());
		WebSocketSession awake = open("2");
		live.afterConnectionEstablished(asleep);
		live.afterConnectionEstablished(awake);

		live.onChange(new LiveChange(LiveTopic.LOGS));

		assertThat(live.connections()).isEqualTo(1);
		verify(awake).sendMessage(new TextMessage("{\"topic\":\"LOGS\"}"));
	}

	@Test
	void keepsTheConnectionsAliveOnlyWhenThereAreSome() throws IOException {
		live.heartbeat();
		WebSocketSession yona = open("1");
		live.afterConnectionEstablished(yona);

		live.heartbeat();

		verify(yona).sendMessage(new TextMessage(AdminLive.HEARTBEAT));
	}

}
