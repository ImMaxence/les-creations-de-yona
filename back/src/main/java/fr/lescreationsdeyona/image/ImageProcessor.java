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
import java.util.Optional;
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
 * <li>Landscape or square, at least 800 × 450 (1.12; 1200 × 800 and 4:3 before); or portrait for
 * Pinterest, at least 600 × 800 and 3:4. The same for a photo of the site retouched in the back-office,
 * made from its 1600 px file. Checked once the EXIF orientation is applied. A photo of the messages
 * between the admins: any shape, at least 50 × 50; the image of a page linked in one may also be WebP or
 * GIF, read by the server itself.</li>
 * <li>Re-encoded from the pixels alone: EXIF metadata, GPS position included, is dropped.</li>
 * <li>Shrunk to 800 and 1600 px wide, never enlarged. The original is not kept.</li>
 * </ul>
 */
@Component
public class ImageProcessor {

	public static final List<Integer> WIDTHS = List.of(800, 1600);

	private static final int MIN_WIDTH = 800;

	private static final int MIN_HEIGHT = 450;

	private static final int PORTRAIT_MIN_WIDTH = 600;

	private static final int PORTRAIT_MIN_HEIGHT = 800;

	private static final int RECEIPT_MIN_SIDE = 300;

	/** Stops decompression bombs: a small file declaring a huge canvas. */
	private static final long MAX_PIXELS = 100_000_000;

	private static final float WEBP_QUALITY = 0.8f;

	private static final byte[] JPEG_SIGNATURE = { (byte) 0xFF, (byte) 0xD8, (byte) 0xFF };

	private static final byte[] PNG_SIGNATURE = { (byte) 0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n' };

	private static final byte[] RIFF_SIGNATURE = { 'R', 'I', 'F', 'F' };

	private static final byte[] WEBP_SIGNATURE = { 'W', 'E', 'B', 'P' };

	private static final byte[] GIF_SIGNATURE = { 'G', 'I', 'F', '8' };

	private static final int MESSAGE_MIN_SIDE = 50;

	/** The image of a link's preview: a card, not a photo to open big. */
	private static final int PREVIEW_WIDTH = 800;

	ImageProcessor() {
		// Registers the TwelveMonkeys JPEG and WebP plugins found on the application class path, and
		// keeps Image I/O buffers in memory rather than in temporary files.
		ImageIO.scanForPlugins();
		ImageIO.setUseCache(false);
	}

	/** A photo shown on the site: landscape or square. */
	public ProcessedImage process(MultipartFile file) {
		return process(file, Shape.LANDSCAPE);
	}

	/** The vertical photo of a recipe, offered to Pinterest. */
	public ProcessedImage processPortrait(MultipartFile file) {
		return process(file, Shape.PORTRAIT);
	}

	/** The receipt of an expense: any shape (a long ticket), at least 300 × 300. */
	public ProcessedImage processReceipt(MultipartFile file) {
		return process(file, Shape.ANY);
	}

	/** A photo and its size once upright: a page lays it out before it loads. */
	public record Sized(ProcessedImage processed, int width, int height) {
	}

	/** A photo sent in a message, or the photo of a group: any shape, at least 50 × 50 (a screenshot, a long one). */
	public Sized processMessage(MultipartFile file) {
		if (file.isEmpty()) {
			throw new ApiException(ErrorCode.IMAGE_REQUIRED);
		}
		byte[] content = readBytes(file);
		String format = detectFormat(content);
		ExifOrientation orientation = ExifOrientation.of(content);
		BufferedImage upright = orientation.applyTo(toRgb(decode(content, format, orientation, Shape.MESSAGE)));
		ProcessedImage processed = new ProcessedImage(WIDTHS.stream()
			.map(width -> new ProcessedImage.Variant(width, encodeWebp(shrinkToWidth(upright, width))))
			.toList());
		return new Sized(processed, upright.getWidth(), upright.getHeight());
	}

	/**
	 * The image of a page a message links to (its og:image): JPEG, PNG, WebP or GIF (its first frame),
	 * 800 px wide at most, the same file for both widths. Empty when it cannot be read or is a mere icon.
	 */
	public Optional<Sized> processPreview(byte[] content) {
		try {
			String format = detectPreviewFormat(content);
			ExifOrientation orientation = format.equals("jpeg") ? ExifOrientation.of(content) : ExifOrientation.NORMAL;
			BufferedImage shrunk = shrinkToWidth(orientation.applyTo(toRgb(decode(content, format, orientation, Shape.MESSAGE))),
					PREVIEW_WIDTH);
			byte[] webp = encodeWebp(shrunk);
			ProcessedImage processed = new ProcessedImage(WIDTHS.stream().map(width -> new ProcessedImage.Variant(width, webp)).toList());
			return Optional.of(new Sized(processed, shrunk.getWidth(), shrunk.getHeight()));
		}
		catch (ApiException | UncheckedIOException ex) {
			return Optional.empty();
		}
	}

	private enum Shape {
		LANDSCAPE, PORTRAIT, ANY, MESSAGE
	}

	private ProcessedImage process(MultipartFile file, Shape shape) {
		if (file.isEmpty()) {
			throw new ApiException(ErrorCode.IMAGE_REQUIRED);
		}
		byte[] content = readBytes(file);
		String format = detectFormat(content);
		ExifOrientation orientation = ExifOrientation.of(content);
		BufferedImage upright = orientation.applyTo(toRgb(decode(content, format, orientation, shape)));
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

	/** "image/jpeg" or "image/png", from the first bytes of the file; any other format is refused. */
	public static String mediaType(byte[] content) {
		return "image/" + detectFormat(content);
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

	/** Image I/O format name of an image found on the web: also WebP ("RIFF", size, "WEBP") and GIF. */
	private static String detectPreviewFormat(byte[] content) {
		if (startsWith(content, RIFF_SIGNATURE) && content.length >= 12
				&& Arrays.equals(content, 8, 12, WEBP_SIGNATURE, 0, WEBP_SIGNATURE.length)) {
			return "webp";
		}
		if (startsWith(content, GIF_SIGNATURE)) {
			return "gif";
		}
		return detectFormat(content);
	}

	private static boolean startsWith(byte[] content, byte[] signature) {
		return content.length >= signature.length
				&& Arrays.equals(content, 0, signature.length, signature, 0, signature.length);
	}

	/** Checks the size from the file header, then decodes only the pixels the largest output needs. */
	private static BufferedImage decode(byte[] content, String format, ExifOrientation orientation,
			Shape shape) {
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
			switch (shape) {
				case PORTRAIT -> checkPortraitDimensions(width, height);
				case LANDSCAPE -> checkDimensions(width, height);
				case ANY -> checkReceiptDimensions(width, height);
				case MESSAGE -> {
					if (width < MESSAGE_MIN_SIDE || height < MESSAGE_MIN_SIDE) {
						throw new ApiException(ErrorCode.MESSAGE_IMAGE_TOO_SMALL);
					}
				}
			}

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
		// Landscape or square: the site crops its photos to fit (4:3, 16:10…) anyway
		if (width < height) {
			throw new ApiException(ErrorCode.IMAGE_NOT_LANDSCAPE);
		}
	}

	private static void checkReceiptDimensions(int width, int height) {
		if (width < RECEIPT_MIN_SIDE || height < RECEIPT_MIN_SIDE) {
			throw new ApiException(ErrorCode.RECEIPT_TOO_SMALL);
		}
	}

	/** Pinterest favors tall pins: 2:3 is advised, 3:4 is the widest accepted. */
	private static void checkPortraitDimensions(int width, int height) {
		if (width < PORTRAIT_MIN_WIDTH || height < PORTRAIT_MIN_HEIGHT) {
			throw new ApiException(ErrorCode.PORTRAIT_IMAGE_TOO_SMALL);
		}
		// height / width >= 4 / 3, without rounding.
		if (3L * height < 4L * width) {
			throw new ApiException(ErrorCode.IMAGE_NOT_PORTRAIT);
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
