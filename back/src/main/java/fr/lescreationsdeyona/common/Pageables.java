package fr.lescreationsdeyona.common;

import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import java.util.Set;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

public final class Pageables {

	private Pageables() {
	}

	/** Rejects sorting on fields outside the allowlist, so a client cannot sort on any column. */
	public static Pageable requireSortedOn(Pageable pageable, Set<String> allowedProperties) {
		for (Sort.Order order : pageable.getSort()) {
			if (!allowedProperties.contains(order.getProperty())) {
				throw new ApiException(ErrorCode.INVALID_SORT);
			}
		}
		return pageable;
	}

}
