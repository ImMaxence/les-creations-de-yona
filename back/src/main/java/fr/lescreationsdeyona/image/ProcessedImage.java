package fr.lescreationsdeyona.image;

import java.util.List;

/** An upload ready to store: one WebP file per width served by the site. */
public record ProcessedImage(List<Variant> variants) {

	public record Variant(int width, byte[] webp) {
	}

}
