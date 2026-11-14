package fr.lescreationsdeyona.nutrition;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@Tag(name = "Admin - Nutrition")
@RestController
@RequestMapping("/api/admin/nutrition")
@RequiredArgsConstructor
class AdminNutritionController {

	private final NutritionService nutritionService;

	@Operation(summary = "The version of the Ciqual table the site uses, and its number of foods")
	@GetMapping("/ciqual")
	CiqualTable getCiqualTable() {
		return nutritionService.ciqualTable();
	}

	@Operation(summary = "Import a new version of the Ciqual table: the Excel file (.xlsx) the Anses publishes",
			description = "Foods kept by their code, new ones added, those gone deleted: the ingredients linked to them are "
					+ "named in the answer, to be linked again. All or nothing.")
	@PostMapping(path = "/ciqual", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
	CiqualImport importCiqualTable(@RequestPart("file") MultipartFile file) {
		return nutritionService.importCiqual(file);
	}

	@Operation(summary = "Foods of the Ciqual table whose name has each word typed, the closest first, 20 at most")
	@GetMapping("/ciqual/foods")
	List<CiqualFood> searchCiqualFoods(@RequestParam @NotBlank @Size(max = 100) String q) {
		return nutritionService.searchCiqual(q);
	}

	@Operation(summary = "Products of Open Food Facts by name or barcode, with the values of their label for 100 g",
			description = "Asked to Open Food Facts at once, 10 products at most; 502 when it does not answer.")
	@GetMapping("/open-food-facts")
	List<OpenFoodFactsProduct> searchOpenFoodFacts(@RequestParam @NotBlank @Size(max = 100) String q) {
		return nutritionService.searchOpenFoodFacts(q);
	}

}
