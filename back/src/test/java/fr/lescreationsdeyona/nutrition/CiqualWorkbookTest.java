package fr.lescreationsdeyona.nutrition;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import fr.lescreationsdeyona.error.ApiException;
import fr.lescreationsdeyona.error.ErrorCode;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.Test;

/** The table as the Anses publishes it: an .xlsx built here, with the headers of the 2025 version. */
class CiqualWorkbookTest {

	/** The headers of the 2025 table, line breaks included, Jones proteins before N x 6.25. */
	private static final List<String> HEADERS = List.of("alim_grp_code", "alim_ssgrp_code", "alim_ssssgrp_code", "alim_grp_nom_fr",
			"alim_ssgrp_nom_fr", "alim_ssssgrp_nom_fr", "alim_code", "alim_nom_fr", "alim_nom_sci",
			"Energie,\nRèglement\nUE N°\n1169\n2011 (kJ\n100 g)", "Energie,\nRèglement\nUE N°\n1169\n2011 (kcal\n100 g)",
			"Protéines,\nN x\nfacteur de\nJones (g\n100 g)", "Protéines,\nN x 6.25\n(g\n100 g)", "Glucides\n(g\n100 g)",
			"Lipides\n(g\n100 g)", "Sucres\n(g\n100 g)", "Fibres\nalimentaires\n(g\n100 g)", "AG\nsaturés\n(g\n100 g)",
			"Sel\nchlorure\nde\nsodium\n(g\n100 g)");

	/** A cell: a text (shared string), or a number cell when it starts with "#". */
	private static byte[] workbook(List<String> headers, List<List<String>> rows) throws IOException {
		Map<String, Integer> shared = new LinkedHashMap<>();
		StringBuilder sheet = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
				+ "<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><sheetData>");
		List<List<String>> all = new ArrayList<>();
		all.add(headers);
		all.addAll(rows);
		for (int r = 0; r < all.size(); r++) {
			sheet.append("<row r=\"").append(r + 1).append("\">");
			List<String> cells = all.get(r);
			for (int c = 0; c < cells.size(); c++) {
				String value = cells.get(c);
				if (value == null) {
					continue;
				}
				String reference = column(c) + (r + 1);
				if (value.startsWith("#")) {
					sheet.append("<c r=\"").append(reference).append("\"><v>").append(value.substring(1)).append("</v></c>");
				}
				else {
					int index = shared.computeIfAbsent(value, key -> shared.size());
					sheet.append("<c r=\"").append(reference).append("\" t=\"s\"><v>").append(index).append("</v></c>");
				}
			}
			sheet.append("</row>");
		}
		sheet.append("</sheetData></worksheet>");
		StringBuilder strings = new StringBuilder("<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
				+ "<sst xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">");
		shared.keySet().forEach(text -> strings.append("<si><t>").append(text.replace("&", "&amp;").replace("<", "&lt;"))
			.append("</t></si>"));
		strings.append("</sst>");
		ByteArrayOutputStream bytes = new ByteArrayOutputStream();
		try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
			zip.putNextEntry(new ZipEntry("[Content_Types].xml"));
			zip.write("<Types/>".getBytes(StandardCharsets.UTF_8));
			zip.putNextEntry(new ZipEntry("xl/sharedStrings.xml"));
			zip.write(strings.toString().getBytes(StandardCharsets.UTF_8));
			zip.putNextEntry(new ZipEntry("xl/worksheets/sheet1.xml"));
			zip.write(sheet.toString().getBytes(StandardCharsets.UTF_8));
		}
		return bytes.toByteArray();
	}

	private static String column(int index) {
		return index < 26 ? String.valueOf((char) ('A' + index)) : "A" + (char) ('A' + index - 26);
	}

	/** Pastis, a food with a number cell, then enough others to look like the table. */
	private static List<List<String>> rows() {
		List<List<String>> rows = new ArrayList<>();
		rows.add(List.of("06", "0603", "060303", "eaux et autres boissons", "boisson alcoolisées", "-", "1000", "Pastis", "-",
				"1140", "274", "0", "0,1", "< 0,5", "traces", "-", "#2.5", "0,11", "0,02"));
		rows.add(List.of("06", "#603", "060303", "eaux et autres boissons", "-", "-", "#1001", "  Eau de vie   de fruits ", "-",
				"966", "233", "0", "0", "0,63", "0", "0", "0", "0", "0,004"));
		// Its code again: the first row is kept
		rows.add(List.of("06", "0603", "060303", "x", "x", "x", "1000", "Autre pastis", "-", "1", "1", "1", "1", "1", "1", "1",
				"1", "1", "1"));
		for (int index = 0; index < CiqualWorkbook.MIN_FOODS; index++) {
			rows.add(List.of("02", "0204", "020401", "fruits", "fruits", "-", String.valueOf(2000 + index), "Fruit " + index, "-",
					"200", "48", "0,5", "0,5", "11", "0,2", "10", "2", "0", "0"));
		}
		return rows;
	}

	@Test
	void readsTheFoodsByTheHeadersOfTheirColumns() throws IOException {
		List<CiqualRow> foods = CiqualWorkbook.read(new ByteArrayInputStream(workbook(HEADERS, rows())));

		assertThat(foods).hasSize(CiqualWorkbook.MIN_FOODS + 2);
		CiqualRow pastis = foods.getFirst();
		assertThat(pastis.code()).isEqualTo(1000);
		assertThat(pastis.name()).isEqualTo("Pastis");
		assertThat(pastis.subgroupCode()).isEqualTo("0603");
		assertThat(pastis.subgroupName()).isEqualTo("boisson alcoolisées");
		assertThat(pastis.kcal()).isEqualByComparingTo("274");
		// N x 6.25, not the Jones factor
		assertThat(pastis.proteins()).isEqualByComparingTo("0.1");
		// "< 0,5" and "traces" are 0, "-" is not given
		assertThat(pastis.carbohydrates()).isEqualByComparingTo("0");
		assertThat(pastis.fat()).isEqualByComparingTo("0");
		assertThat(pastis.sugars()).isNull();
		assertThat(pastis.fibre()).isEqualByComparingTo("2.5");
		assertThat(pastis.saturatedFat()).isEqualByComparingTo("0.11");
		assertThat(pastis.salt()).isEqualByComparingTo("0.02");
		CiqualRow brandy = foods.get(1);
		assertThat(brandy.name()).isEqualTo("Eau de vie de fruits");
		assertThat(brandy.subgroupCode()).isEqualTo("0603");
		assertThat(brandy.subgroupName()).isNull();
	}

	@Test
	void namesAColumnMissing() throws IOException {
		List<String> withoutSugars = new ArrayList<>(HEADERS);
		withoutSugars.set(15, "Autre chose");
		byte[] file = workbook(withoutSugars, rows());

		assertThatThrownBy(() -> CiqualWorkbook.read(new ByteArrayInputStream(file))).isInstanceOf(ApiException.class)
			.hasMessageContaining("Sucres");
	}

	@Test
	void refusesWhatIsNotTheTable() throws IOException {
		assertThatThrownBy(() -> CiqualWorkbook.read(new ByteArrayInputStream("pas un classeur".getBytes(StandardCharsets.UTF_8))))
			.extracting("code").isEqualTo(ErrorCode.CIQUAL_FILE_INVALID);
		// A few foods only
		byte[] small = workbook(HEADERS, rows().subList(0, 10));
		assertThatThrownBy(() -> CiqualWorkbook.read(new ByteArrayInputStream(small))).extracting("code")
			.isEqualTo(ErrorCode.CIQUAL_FILE_INVALID);
		// Another sheet: no alim_code
		byte[] other = workbook(List.of("Nom", "Prix"), List.of(List.of("Beurre", "#2")));
		assertThatThrownBy(() -> CiqualWorkbook.read(new ByteArrayInputStream(other))).extracting("code")
			.isEqualTo(ErrorCode.CIQUAL_FILE_INVALID);
	}

	@Test
	void readsTheAmountsAsTheTableWritesThem() {
		assertThat(CiqualWorkbook.amount("59,7")).isEqualByComparingTo(new BigDecimal("59.7"));
		assertThat(CiqualWorkbook.amount(" 0.071 ")).isEqualByComparingTo(new BigDecimal("0.071"));
		assertThat(CiqualWorkbook.amount("traces")).isEqualByComparingTo(BigDecimal.ZERO);
		assertThat(CiqualWorkbook.amount("< 0,05")).isEqualByComparingTo(BigDecimal.ZERO);
		assertThat(CiqualWorkbook.amount("-")).isNull();
		assertThat(CiqualWorkbook.amount("")).isNull();
		assertThat(CiqualWorkbook.amount("n.d.")).isNull();
		assertThat(CiqualWorkbook.amount("-3")).isNull();
	}

	@Test
	void namesTheVersionAfterTheFile() {
		LocalDate today = LocalDate.of(2028, 3, 1);
		assertThat(CiqualWorkbook.versionOf("Table Ciqual 2025_FR_2025_11_03.xlsx", today)).isEqualTo("Ciqual 2025");
		assertThat(CiqualWorkbook.versionOf("ciqual-2028.xlsx", today)).isEqualTo("Ciqual 2028");
		assertThat(CiqualWorkbook.versionOf("table.xlsx", today)).isEqualTo("Ciqual, importée le 01/03/2028");
		assertThat(CiqualWorkbook.versionOf(null, today)).isEqualTo("Ciqual, importée le 01/03/2028");
	}

	@Test
	void foldsTheHeaders() {
		assertThat(CiqualWorkbook.folded("Energie,\nRèglement\nUE N°\n1169\n2011 (kcal\n100 g)"))
			.isEqualTo("energie reglement ue n 1169 2011 kcal 100 g");
		assertThat(CiqualWorkbook.Column.of("AG\nsaturés\n(g\n100 g)")).isEqualTo(CiqualWorkbook.Column.SATURATED_FAT);
		assertThat(CiqualWorkbook.Column.of("Energie,\nRèglement\nUE N°\n1169\n2011 (kJ\n100 g)")).isNull();
	}

}
