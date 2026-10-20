package fr.lescreationsdeyona.image;

import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.Arrays;
import java.util.List;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReadParam;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;
import javax.imageio.stream.MemoryCacheImageInputStream;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

/**
 * Turns an uploaded photo into the WebP files served by the site.
 * <ul>
 * <li>JPEG or PNG only, recognised from the file content, never from its name.</li>
 * <li>Landscape only, at least 1200 × 800 and 4:3, checked once the EXIF orientation is applied.</li>
 * <li>Re-encoded from the pixels alone: EXIF metadata, GPS position included, is dropped.</li>
 * <li>Shrunk to 800 and 1600 px wide, never enlarged. The original is not kept.</li>
 * </ul>
 */
@Component
public class ImageProcessor {

	public static final List<Integer> WIDTHS = List.of(800, 1600);

	private static final int MIN_WIDTH = 1200;

	private static final int MIN_HEIGHT = 800;

	/** Stops decompression bombs: a small file declaring a huge canvas. */
	private static final long MAX_PIXELS = 100_000_000;

	private static final float WEBP_QUALITY = 0.8f;

	private static final byte[] JPEG_SIGNATURE = { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF };

	private static final byte[] PNG_SIGNATURE = { (byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n' };

	ImageProcessor() {
		// Registers the TwelveMonkeys JPEG and WebP plugins found on the application class path, and
		// keeps Image I/O buffers in memory rather than in temporary files.
		ImageIO.scanForPlugins();
		ImageIO.setUseCache(false);
	}

	public ProcessedImage process(MultipartFile file) {
		if (file.isEmpty()) {
			throw new ApiException(ErrorCode.IMAGE_REQUIRED);
		}
		byte[] content = readBytes(file);
		String format = detectFormat(content);
		ExifOrientation orientation = ExifOrientation.of(content);
		BufferedImage upright = orientation.applyTo(toRgb(decode(content, format, orientation)));
		return new ProcessedImage(WIDTHS.stream()
			.map(width -> new ProcessedImage.Variant(width, encodeWebp(shrinkToWidth(upright, width))))
			.toList());
	}

	private static byte[] readBytes(MultipartFile file) {
		try {
			return file.getBytes();
		}
		catch (IOException ex) {
			throw new UncheckedIOException(ex);
		}
	}

	/** Image I/O format name, from the first bytes of the file. */
	private static String detectFormat(byte[] content) {
		if (startsWith(content, JPEG_SIGNATURE)) {
			return "jpeg";
		}
		if (startsWith(content, PNG_SIGNATURE)) {
			return "png";
		}
		throw new ApiException(ErrorCode.IMAGE_FORMAT_UNSUPPORTED);
	}

	private static boolean startsWith(byte[] content, byte[] signature) {
		return content.length >= signature.length
				&& Arrays.equals(content, 0, signature.length, signature, 0, signature.length);
	}

	/** Checks the size from the file header, then decodes only the pixels the largest output needs. */
	private static BufferedImage decode(byte[] content, String format, ExifOrientation orientation) {
		ImageReader reader = ImageIO.getImageReadersByFormatName(format).next();
		try (ImageInputStream input = new MemoryCacheImageInputStream(new ByteArrayInputStream(content))) {
			reader.setInput(input, true, true);
			int storedWidth = reader.getWidth(0);
			int storedHeight = reader.getHeight(0);
			if ((long) storedWidth * storedHeight > MAX_PIXELS) {
				throw new ApiException(ErrorCode.IMAGE_TOO_MANY_PIXELS);
			}
			int width = orientation.swapsAxes() ? storedHeight : storedWidth;
			int height = orientation.swapsAxes() ? storedWidth : storedHeight;
			checkDimensions(width, height);

			// Reading one pixel in n keeps memory low on large photos. Staying above twice the largest
			// output leaves enough detail for a smooth final shrink.
			int step = Math.max(1, width / (2 * WIDTHS.getLast()));
			ImageReadParam param = reader.getDefaultReadParam();
			param.setSourceSubsampling(step, step, 0, 0);
			return reader.read(0, param);
		}
		catch (ApiException ex) {
			throw ex;
		}
		catch (IOException | RuntimeException ex) {
			throw new ApiException(ErrorCode.IMAGE_UNREADABLE, ex);
		}
		finally {
			reader.dispose();
		}
	}

	private static void checkDimensions(int width, int height) {
		if (width < MIN_WIDTH || height < MIN_HEIGHT) {
			throw new ApiException(ErrorCode.IMAGE_TOO_SMALL);
		}
		// width / height >= 4 / 3, without rounding.
		if (3L * width < 4L * height) {
			throw new ApiException(ErrorCode.IMAGE_NOT_LANDSCAPE);
		}
	}

	/** Same pixels in a standard 8-bit RGB layout (ARGB if transparent), whatever the source encoding. */
	private static BufferedImage toRgb(BufferedImage image) {
		int type = image.getColorModel().hasAlpha() ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB;
		return image.getType() == type ? image : draw(image, image.getWidth(), image.getHeight(), type);
	}

	private static BufferedImage shrinkToWidth(BufferedImage image, int maxWidth) {
		BufferedImage current = image;
		// Halving step by step blends every source pixel; a single big bilinear jump would skip most of them.
		while (current.getWidth() >= 2 * maxWidth) {
			current = draw(current, current.getWidth() / 2, current.getHeight() / 2, current.getType());
		}
		if (current.getWidth() <= maxWidth) {
			return current;
		}
		int height = Math.round((float) current.getHeight() * maxWidth / current.getWidth());
		return draw(current, maxWidth, height, current.getType());
	}

	private static BufferedImage draw(BufferedImage source, int width, int height, int type) {
		BufferedImage target = new BufferedImage(width, height, type);
		Graphics2D graphics = target.createGraphics();
		graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
		graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
		graphics.drawImage(source, 0, 0, width, height, null);
		graphics.dispose();
		return target;
	}

	private static byte[] encodeWebp(BufferedImage image) {
		ImageWriter writer = ImageIO.getImageWritersByMIMEType("image/webp").next();
		ImageWriteParam param = writer.getDefaultWriteParam();
		param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
		param.setCompressionType("Lossy");
		param.setCompressionQuality(WEBP_QUALITY);
		ByteArrayOutputStream webp = new ByteArrayOutputStream();
		try (ImageOutputStream output = new MemoryCacheImageOutputStream(webp)) {
			writer.setOutput(output);
			writer.write(null, new IIOImage(image, null, null), param);
		}
		catch (IOException ex) {
			throw new UncheckedIOException(ex);
		}
		finally {
			writer.dispose();
		}
		return webp.toByteArray();
	}

}
