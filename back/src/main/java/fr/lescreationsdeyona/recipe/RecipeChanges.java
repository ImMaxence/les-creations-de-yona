package fr.lescreationsdeyona.recipe;

import fr.lescreationsdeyona.audit.AuditChanges;
import fr.lescreationsdeyona.category.CategoryResponse;
import fr.lescreationsdeyona.tag.TagResponse;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;

/** What a save of the editor changed in a recipe, for the history, in the words of the back-office. */
final class RecipeChanges {

	private static final RecipeDetail.Part NO_PART = new RecipeDetail.Part(null, List.of(), List.of());

	private RecipeChanges() {
	}

	static AuditChanges between(RecipeDetail before, RecipeDetail after) {
		AuditChanges changes = new AuditChanges()
			.add("Titre", before.title(), after.title())
			.add("Introduction", before.intro(), after.intro())
			.add("Statut", status(before.status()), status(after.status()))
			.add("Publication programmée", before.scheduledAt(), after.scheduledAt())
			.add("À la une", before.featured(), after.featured())
			.add("Thème", theme(before.theme()), theme(after.theme()))
			.add("Catégories", before.categories().stream().map(CategoryResponse::name).toList(),
					after.categories().stream().map(CategoryResponse::name).toList())
			.add("Tags", before.tags().stream().map(TagResponse::name).toList(),
					after.tags().stream().map(TagResponse::name).toList())
			.add("Nombre de personnes", before.servings(), after.servings())
			.add("Préparation", minutes(before.prepMinutes()), minutes(after.prepMinutes()))
			.add("Cuisson", minutes(before.cookMinutes()), minutes(after.cookMinutes()))
			.add("Repos", minutes(before.restMinutes()), minutes(after.restMinutes()))
			.add("Difficulté", difficulty(before.difficulty()), difficulty(after.difficulty()))
			.add("Moule", mold(before.mold()), mold(after.mold()))
			.addLines("Matériel", before.equipment(), after.equipment())
			.add("Le conseil de Yona", before.tip(), after.tip())
			.add("Vidéo", video(before.youtubeVideoId()), video(after.youtubeVideoId()));
		int partCount = Math.max(before.parts().size(), after.parts().size());
		for (int index = 0; index < partCount; index++) {
			RecipeDetail.Part partBefore = index < before.parts().size() ? before.parts().get(index) : NO_PART;
			RecipeDetail.Part partAfter = index < after.parts().size() ? after.parts().get(index) : NO_PART;
			String title = partAfter.title() != null ? partAfter.title() : partBefore.title();
			String of = title == null ? "" : " (" + title + ")";
			if (partCount > 1) {
				changes.add("Partie " + (index + 1), partBefore.title(), partAfter.title());
			}
			changes.addLines("Ingrédients" + of, ingredients(partBefore), ingredients(partAfter))
				.addLines("Étapes" + of, steps(partBefore), steps(partAfter));
		}
		return changes;
	}

	private static String status(RecipeStatus status) {
		return switch (status) {
			case DRAFT -> "Brouillon";
			case PUBLISHED -> "Publiée";
			case FAILED -> "Échec";
		};
	}

	private static @Nullable String theme(@Nullable RecipeTheme theme) {
		return theme == null ? null : theme == RecipeTheme.SWEET ? "Sucré" : "Salé";
	}

	/** "45 min", "1 h 30". */
	static @Nullable String minutes(@Nullable Integer minutes) {
		if (minutes == null) {
			return null;
		}
		if (minutes < 60) {
			return minutes + " min";
		}
		return minutes / 60 + " h" + (minutes % 60 == 0 ? "" : " " + String.format("%02d", minutes % 60));
	}

	private static @Nullable String difficulty(@Nullable BigDecimal difficulty) {
		return difficulty == null ? null : number(difficulty) + " / 5";
	}

	private static @Nullable String mold(RecipeDetail.@Nullable Mold mold) {
		if (mold == null) {
			return null;
		}
		return switch (mold.shape()) {
			case ROUND -> "Rond, " + number(mold.lengthCm()) + " cm";
			case SQUARE -> "Carré, " + number(mold.lengthCm()) + " cm";
			case RECTANGLE -> "Rectangle, " + number(mold.lengthCm()) + " × "
					+ (mold.widthCm() == null ? "?" : number(mold.widthCm())) + " cm";
		};
	}

	private static @Nullable String video(@Nullable String youtubeVideoId) {
		return youtubeVideoId == null ? null : "https://www.youtube.com/watch?v=" + youtubeVideoId;
	}

	/** "200 g Farine (tamisée)". */
	private static List<String> ingredients(RecipeDetail.Part part) {
		return part.ingredients().stream().map(line -> {
			List<String> words = new ArrayList<>();
			if (line.quantity() != null) {
				words.add(number(line.quantity()));
			}
			if (line.unit() != null && !line.unit().isBlank()) {
				words.add(line.unit().strip());
			}
			words.add(line.name());
			String note = line.note() == null || line.note().isBlank() ? "" : " (" + line.note().strip() + ")";
			return String.join(" ", words) + note;
		}).toList();
	}

	/** Its text, then its timer: "Cuire (25 min)". */
	private static List<String> steps(RecipeDetail.Part part) {
		return part.steps().stream()
			.map(step -> step.description().strip() + (step.durationMinutes() == null ? ""
					: " (" + minutes(step.durationMinutes()) + ")"))
			.toList();
	}

	private static String number(BigDecimal number) {
		return number.stripTrailingZeros().toPlainString().replace('.', ',');
	}

}
