package fr.lescreationsdeyona.image;

import com.drew.imaging.ImageMetadataReader;
import com.drew.imaging.ImageProcessingException;
import com.drew.metadata.Metadata;
import com.drew.metadata.exif.ExifIFD0Directory;
import java.awt.Graphics2D;
import java.awt.geom.AffineTransform;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;

/**
 * EXIF orientation tag (values 1 to 8, in this order): how a camera says its stored pixels must be
 * turned to be seen upright. Phones store portrait shots sideways and rely on it.
 */
enum ExifOrientation {

	NORMAL,
	FLIP_HORIZONTAL,
	ROTATE_180,
	FLIP_VERTICAL,
	TRANSPOSE,
	ROTATE_90,
	TRANSVERSE,
	ROTATE_270;

	/** {@link #NORMAL} when the file has no orientation or unreadable metadata: the pixels are shown as stored. */
	static ExifOrientation of(byte[] content) {
		try {
			Metadata metadata = ImageMetadataReader.readMetadata(new ByteArrayInputStream(content), content.length);
			ExifIFD0Directory exif = metadata.getFirstDirectoryOfType(ExifIFD0Directory.class);
			Integer tag = exif == null ? null : exif.getInteger(ExifIFD0Directory.TAG_ORIENTATION);
			return tag != null && tag >= 1 && tag <= values().length ? values()[tag - 1] : NORMAL;
		}
		catch (ImageProcessingException | IOException ex) {
			return NORMAL;
		}
	}

	/** Whether width and height trade places once the image is upright. */
	boolean swapsAxes() {
		return compareTo(TRANSPOSE) >= 0;
	}

	BufferedImage applyTo(BufferedImage image) {
		if (this == NORMAL) {
			return image;
		}
		int width = image.getWidth();
		int height = image.getHeight();
		// Maps a stored pixel (x, y) to its upright position.
		AffineTransform transform = switch (this) {
			case NORMAL -> new AffineTransform();
			case FLIP_HORIZONTAL -> new AffineTransform(-1, 0, 0, 1, width, 0);
			case ROTATE_180 -> new AffineTransform(-1, 0, 0, -1, width, height);
			case FLIP_VERTICAL -> new AffineTransform(1, 0, 0, -1, 0, height);
			case TRANSPOSE -> new AffineTransform(0, 1, 1, 0, 0, 0);
			case ROTATE_90 -> new AffineTransform(0, 1, -1, 0, height, 0);
			case TRANSVERSE -> new AffineTransform(0, -1, -1, 0, height, width);
			case ROTATE_270 -> new AffineTransform(0, -1, 1, 0, 0, width);
		};
		BufferedImage upright = swapsAxes() ? new BufferedImage(height, width, image.getType())
				: new BufferedImage(width, height, image.getType());
		Graphics2D graphics = upright.createGraphics();
		graphics.drawImage(image, transform, null);
		graphics.dispose();
		return upright;
	}

}
