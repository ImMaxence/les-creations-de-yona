package fr.lescreationsdeyona.common;

import java.util.List;
import org.springframework.data.domain.Page;

/** A page of results, with a stable JSON shape for the front (page numbers start at 0). */
public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {

	public static <T> PageResponse<T> of(Page<T> page) {
		return new PageResponse<>(page.getContent(), page.getNumber(), page.getSize(), page.getTotalElements(),
				page.getTotalPages());
	}

}
