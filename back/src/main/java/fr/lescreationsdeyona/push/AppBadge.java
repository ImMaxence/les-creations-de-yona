package fr.lescreationsdeyona.push;

import fr.lescreationsdeyona.message.AdminGroups;
import fr.lescreationsdeyona.shop.ShopOrderService;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

/**
 * The number on the icon of the installed app (2.23), sent with each notification to an admin's device: what awaits
 * them in the back-office, as its menu counts it, the messages they have not read and the orders nobody has handled
 * yet. iOS shows it (the service worker sets it, app-worker.js); Android has no such number, its launcher puts a dot
 * on the icon while a notification is there.
 */
@Component
class AppBadge {

	private final AdminGroups groups;

	private final ShopOrderService orders;

	AppBadge(AdminGroups groups, ShopOrderService orders) {
		this.groups = groups;
		this.orders = orders;
	}

	/** {@code admin}: the one the device receives the messages of; null for a device told of the orders only. */
	long of(@Nullable String admin) {
		return (admin == null ? 0 : groups.unseen(admin).count()) + orders.newCount();
	}

}
