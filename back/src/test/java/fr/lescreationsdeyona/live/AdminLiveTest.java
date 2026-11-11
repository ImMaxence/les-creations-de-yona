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
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

class AdminLiveTest {

	private final AdminLive live = new AdminLive();

	private static WebSocketSession open(String id) {
		WebSocketSession session = mock(WebSocketSession.class);
		when(session.getId()).thenReturn(id);
		when(session.isOpen()).thenReturn(true);
		return session;
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
