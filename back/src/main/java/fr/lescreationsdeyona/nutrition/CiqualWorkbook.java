package fr.lescreationsdeyona.nutrition;

import fr.lescreationsdeyona.common.Texts;
import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import javax.xml.stream.XMLInputFactory;
import javax.xml.stream.XMLStreamConstants;
import javax.xml.stream.XMLStreamException;
import javax.xml.stream.XMLStreamReader;
import org.jspecify.annotations.Nullable;

/**
 * Reads the Ciqual table as the Anses publishes it, in Excel (.xlsx): one sheet, a row per food, a column per
 * constituent, its header naming it ("Sucres (g/100 g)"). An .xlsx is a zip of XML files: read here as such,
 * streamed, without a library. Columns are found by their header, whatever their place, so that a new version
 * adding constituents still reads; one missing is named in the refusal.
 */
final class CiqualWorkbook {

	/** The table holds more than 3 000 foods: fewer is another file. */
	static final int MIN_FOODS = 500;

	/** The sheet of the 2025 table weighs 12 MB once unzipped: room enough, and no zip bomb. */
	private static final int MAX_PART_BYTES = 100 * 1024 * 1024;

	private static final String SHARED_STRINGS = "xl/sharedStrings.xml";

	private static final Pattern SHEET = Pattern.compile("xl/worksheets/sheet(\\d+)\\.xml");

	private static final Pattern NOT_A_WORD = Pattern.compile("[^a-z0-9]+");

	private static final Pattern COLUMN_LETTERS = Pattern.compile("^([A-Z]+)");

	private static final Pattern VERSION_IN_NAME = Pattern.compile("(?i)ciqual\\D{0,3}((?:19|20)\\d{2})");

	private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd/MM/yyyy");

	/** What the site reads of the table, and the header it is found by (folded, see {@link #folded}). */
	enum Column {

		CODE("Code de l'aliment (alim_code)"), NAME("Nom de l'aliment (alim_nom_fr)"),
		SUBGROUP_CODE("Code du sous-groupe (alim_ssgrp_code)"), SUBGROUP_NAME("Nom du sous-groupe (alim_ssgrp_nom_fr)"),
		KCAL("Énergie, Règlement UE N° 1169/2011 (kcal/100 g)"), PROTEINS("Protéines (g/100 g)"),
		CARBOHYDRATES("Glucides (g/100 g)"), SUGARS("Sucres (g/100 g)"), FAT("Lipides (g/100 g)"),
		SATURATED_FAT("AG saturés (g/100 g)"), FIBRE("Fibres alimentaires (g/100 g)"),
		SALT("Sel chlorure de sodium (g/100 g)");

		/** As the refusal names it. */
		private final String label;

		Column(String label) {
			this.label = label;
		}

		/** The column a header names, or null for one the site does not read. */
		static @Nullable Column of(String header) {
			String name = folded(header);
			if (name.equals("alim code")) {
				return CODE;
			}
			if (name.equals("alim nom fr")) {
				return NAME;
			}
			if (name.equals("alim ssgrp code")) {
				return SUBGROUP_CODE;
			}
			if (name.equals("alim ssgrp nom fr")) {
				return SUBGROUP_NAME;
			}
			if (name.startsWith("energie") && name.contains("1169") && name.contains("kcal")) {
				return KCAL;
			}
			if (name.startsWith("proteines")) {
				return PROTEINS;
			}
			if (name.startsWith("glucides")) {
				return CARBOHYDRATES;
			}
			if (name.startsWith("sucres")) {
				return SUGARS;
			}
			if (name.startsWith("lipides")) {
				return FAT;
			}
			if (name.startsWith("ag satures")) {
				return SATURATED_FAT;
			}
			if (name.startsWith("fibres alimentaires")) {
				return FIBRE;
			}
			return name.startsWith("sel chlorure de sodium") ? SALT : null;
		}

	}

	private CiqualWorkbook() {
	}

	/** The foods of the table, each code once (the first row kept); refused when it is not the Ciqual table. */
	static List<CiqualRow> read(InputStream workbook) {
		Map<String, byte[]> parts = new HashMap<>();
		TreeMap<Integer, String> sheets = new TreeMap<>();
		try (ZipInputStream zip = new ZipInputStream(workbook)) {
			for (ZipEntry entry = zip.getNextEntry(); entry != null; entry = zip.getNextEntry()) {
				Matcher sheet = SHEET.matcher(entry.getName());
				if (sheet.matches()) {
					sheets.put(Integer.parseInt(sheet.group(1)), entry.getName());
				}
				if (sheet.matches() || entry.getName().equals(SHARED_STRINGS)) {
					parts.put(entry.getName(), bytes(zip));
				}
			}
		}
		catch (IOException | IllegalArgumentException ex) {
			throw invalid();
		}
		if (sheets.isEmpty()) {
			throw invalid();
		}
		List<String> shared = parts.containsKey(SHARED_STRINGS) ? sharedStrings(parts.get(SHARED_STRINGS)) : List.of();
		for (String sheet : sheets.values()) {
			Foods foods = new Foods();
			rows(parts.get(sheet), shared, foods);
			if (foods.columns != null) {
				Set<Column> missing = new LinkedHashSet<>(List.of(Column.values()));
				missing.remove(Column.SUBGROUP_NAME);
				missing.removeAll(foods.columns.keySet());
				if (!missing.isEmpty()) {
					throw new ApiException(ErrorCode.CIQUAL_FILE_INVALID, "Colonne introuvable dans le fichier : « "
							+ missing.iterator().next().label + " ». Importez la table Ciqual telle que l'Anses la publie");
				}
				if (foods.rows.size() < MIN_FOODS) {
					throw invalid();
				}
				return List.copyOf(foods.rows.values());
			}
		}
		throw invalid();
	}

	/** "Table Ciqual 2025_FR_2025_11_03.xlsx" → "Ciqual 2025"; a file renamed, the day of its import. */
	static String versionOf(@Nullable String fileName, LocalDate today) {
		Matcher year = VERSION_IN_NAME.matcher(fileName == null ? "" : fileName);
		return year.find() ? "Ciqual " + year.group(1) : "Ciqual, importée le " + today.format(DAY);
	}

	/** The rows of the sheet, read one by one: the first one is the header. */
	private static final class Foods implements Consumer<Map<Integer, String>> {

		@Nullable Map<Column, Integer> columns;

		final Map<Integer, CiqualRow> rows = new LinkedHashMap<>();

		private boolean header = true;

		@Override
		public void accept(Map<Integer, String> cells) {
			if (header) {
				header = false;
				Map<Column, Integer> found = new EnumMap<>(Column.class);
				cells.forEach((index, text) -> {
					Column column = Column.of(text);
					// Proteins N x 6.25 (as on the labels) rather than N x Jones factor, whatever their order
					if (column != null && (!found.containsKey(column) || column == Column.PROTEINS && folded(text).contains("6 25"))) {
						found.put(column, index);
					}
				});
				if (found.containsKey(Column.CODE) && found.containsKey(Column.NAME)) {
					columns = found;
				}
				return;
			}
			if (columns == null) {
				return;
			}
			CiqualRow row = row(cells, columns);
			if (row != null) {
				rows.putIfAbsent(row.code(), row);
			}
		}

	}

	private static @Nullable CiqualRow row(Map<Integer, String> cells, Map<Column, Integer> columns) {
		BigDecimal code = number(text(cells, columns, Column.CODE));
		String name = text(cells, columns, Column.NAME);
		if (code == null || code.signum() <= 0 || code.stripTrailingZeros().scale() > 0 || name == null) {
			return null;
		}
		name = name.replaceAll("\\s+", " ").strip();
		if (name.isEmpty() || name.length() > 300 || code.compareTo(BigDecimal.valueOf(Integer.MAX_VALUE)) > 0) {
			return null;
		}
		String subgroupName = text(cells, columns, Column.SUBGROUP_NAME);
		subgroupName = subgroupName == null || subgroupName.isBlank() || subgroupName.strip().equals("-") ? null
				: subgroupName.replaceAll("\\s+", " ").strip();
		if (subgroupName != null && subgroupName.length() > 200) {
			subgroupName = subgroupName.substring(0, 200);
		}
		return new CiqualRow(code.intValue(), name, subgroupCode(text(cells, columns, Column.SUBGROUP_CODE)), subgroupName,
				amount(cells, columns, Column.KCAL), amount(cells, columns, Column.PROTEINS),
				amount(cells, columns, Column.CARBOHYDRATES), amount(cells, columns, Column.SUGARS),
				amount(cells, columns, Column.FAT), amount(cells, columns, Column.SATURATED_FAT),
				amount(cells, columns, Column.FIBRE), amount(cells, columns, Column.SALT));
	}

	private static @Nullable String text(Map<Integer, String> cells, Map<Column, Integer> columns, Column column) {
		Integer index = columns.get(column);
		return index == null ? null : cells.get(index);
	}

	/** "0901", a number cell "901" too; "0000" when the table gives none. */
	private static String subgroupCode(@Nullable String text) {
		String digits = text == null ? "" : text.strip().replaceFirst("\\.0+$", "");
		if (!digits.matches("\\d{1,6}")) {
			return "0000";
		}
		String padded = "0".repeat(Math.max(0, 4 - digits.length())) + digits;
		return padded.substring(0, 4);
	}

	/** "59,7" → 59.7; "traces" and "< 0,5" → 0; "-" or nothing → null (not given). */
	static @Nullable BigDecimal amount(@Nullable String text) {
		if (text == null) {
			return null;
		}
		String cleaned = text.replace('\u00a0', ' ').strip().toLowerCase(Locale.ROOT);
		if (cleaned.isEmpty() || cleaned.equals("-")) {
			return null;
		}
		if (cleaned.equals("traces") || cleaned.startsWith("<")) {
			return BigDecimal.ZERO;
		}
		BigDecimal value = number(cleaned);
		return value == null || value.signum() < 0 || value.compareTo(BigDecimal.valueOf(999_999)) > 0 ? null
				: value.setScale(Math.min(3, Math.max(0, value.scale())), RoundingMode.HALF_UP);
	}

	private static @Nullable BigDecimal amount(Map<Integer, String> cells, Map<Column, Integer> columns, Column column) {
		return amount(text(cells, columns, column));
	}

	private static @Nullable BigDecimal number(@Nullable String text) {
		if (text == null) {
			return null;
		}
		try {
			return new BigDecimal(text.strip().replace(" ", "").replace(',', '.'));
		}
		catch (NumberFormatException ex) {
			return null;
		}
	}

	/** "Energie,\nRèglement\nUE N°…(kcal\n100 g)" → "energie reglement ue n 1169 2011 kcal 100 g". */
	static String folded(String header) {
		return NOT_A_WORD.matcher(Texts.foldCaseAndAccents(header)).replaceAll(" ").strip();
	}

	/** The texts the cells point to by their index; a text in several runs (formatted) joined. */
	private static List<String> sharedStrings(byte[] xml) {
		List<String> strings = new ArrayList<>();
		try {
			XMLStreamReader reader = reader(xml);
			StringBuilder text = null;
			int phonetic = 0;
			boolean inText = false;
			while (reader.hasNext()) {
				int event = reader.next();
				if (event == XMLStreamConstants.START_ELEMENT) {
					switch (reader.getLocalName()) {
						case "si" -> text = new StringBuilder();
						case "rPh" -> phonetic++;
						case "t" -> inText = phonetic == 0;
						default -> {
						}
					}
				}
				else if (event == XMLStreamConstants.END_ELEMENT) {
					switch (reader.getLocalName()) {
						case "si" -> strings.add(text == null ? "" : text.toString());
						case "rPh" -> phonetic--;
						case "t" -> inText = false;
						default -> {
						}
					}
				}
				else if ((event == XMLStreamConstants.CHARACTERS || event == XMLStreamConstants.CDATA) && inText && text != null) {
					text.append(reader.getText());
				}
			}
		}
		catch (XMLStreamException ex) {
			throw invalid();
		}
		return strings;
	}

	/** Each row of a sheet, as its texts by column (from 0), to {@code rows}. */
	private static void rows(byte[] xml, List<String> shared, Consumer<Map<Integer, String>> rows) {
		try {
			XMLStreamReader reader = reader(xml);
			Map<Integer, String> cells = null;
			int column = -1;
			String type = null;
			StringBuilder value = null;
			boolean inValue = false;
			while (reader.hasNext()) {
				int event = reader.next();
				if (event == XMLStreamConstants.START_ELEMENT) {
					switch (reader.getLocalName()) {
						case "row" -> {
							cells = new HashMap<>();
							column = -1;
						}
						case "c" -> {
							String reference = reader.getAttributeValue(null, "r");
							column = reference == null ? column + 1 : columnIndex(reference, column + 1);
							type = reader.getAttributeValue(null, "t");
							value = new StringBuilder();
						}
						case "v", "t" -> inValue = value != null;
						default -> {
						}
					}
				}
				else if (event == XMLStreamConstants.END_ELEMENT) {
					switch (reader.getLocalName()) {
						case "v", "t" -> inValue = false;
						case "c" -> {
							if (cells != null && value != null) {
								String text = cellText(type, value.toString(), shared);
								if (text != null) {
									cells.put(column, text);
								}
							}
							value = null;
						}
						case "row" -> {
							if (cells != null) {
								rows.accept(cells);
							}
							cells = null;
						}
						default -> {
						}
					}
				}
				else if ((event == XMLStreamConstants.CHARACTERS || event == XMLStreamConstants.CDATA) && inValue && value != null) {
					value.append(reader.getText());
				}
			}
		}
		catch (XMLStreamException ex) {
			throw invalid();
		}
	}

	private static @Nullable String cellText(@Nullable String type, String value, List<String> shared) {
		if ("s".equals(type)) {
			try {
				int index = Integer.parseInt(value.strip());
				return index >= 0 && index < shared.size() ? shared.get(index) : null;
			}
			catch (NumberFormatException ex) {
				return null;
			}
		}
		return value;
	}

	/** "H2" → 7. */
	private static int columnIndex(String reference, int fallback) {
		Matcher letters = COLUMN_LETTERS.matcher(reference);
		if (!letters.find()) {
			return fallback;
		}
		int index = 0;
		for (char letter : letters.group(1).toCharArray()) {
			index = index * 26 + (letter - 'A' + 1);
		}
		return index - 1;
	}

	private static XMLStreamReader reader(byte[] xml) throws XMLStreamException {
		XMLInputFactory factory = XMLInputFactory.newFactory();
		factory.setProperty(XMLInputFactory.SUPPORT_DTD, false);
		factory.setProperty(XMLInputFactory.IS_SUPPORTING_EXTERNAL_ENTITIES, false);
		return factory.createXMLStreamReader(new ByteArrayInputStream(xml));
	}

	private static byte[] bytes(InputStream part) throws IOException {
		ByteArrayOutputStream out = new ByteArrayOutputStream();
		byte[] buffer = new byte[64 * 1024];
		for (int read = part.read(buffer); read >= 0; read = part.read(buffer)) {
			out.write(buffer, 0, read);
			if (out.size() > MAX_PART_BYTES) {
				throw new IOException("Part too large");
			}
		}
		return out.toByteArray();
	}

	private static ApiException invalid() {
		return new ApiException(ErrorCode.CIQUAL_FILE_INVALID);
	}

}
