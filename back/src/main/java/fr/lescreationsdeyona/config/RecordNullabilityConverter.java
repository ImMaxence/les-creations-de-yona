package fr.lescreationsdeyona.config;

import io.swagger.v3.core.converter.AnnotatedType;
import io.swagger.v3.core.converter.ModelConverter;
import io.swagger.v3.core.converter.ModelConverterContext;
import io.swagger.v3.core.util.Json;
import io.swagger.v3.oas.models.media.Schema;
import java.lang.reflect.RecordComponent;
import java.util.Iterator;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

/**
 * Marks every record component as required in the OpenAPI description, unless it is annotated
 * with JSpecify {@link Nullable}. The front generates its types from it, so a non-null field of a
 * DTO becomes a non-optional property in TypeScript.
 */
@Component
class RecordNullabilityConverter implements ModelConverter {

	private static final String SCHEMA_REF_PREFIX = "#/components/schemas/";

	@Override
	public @Nullable Schema<?> resolve(AnnotatedType type, ModelConverterContext context,
			Iterator<ModelConverter> chain) {
		Schema<?> schema = chain.hasNext() ? chain.next().resolve(type, context, chain) : null;
		Class<?> rawClass = Json.mapper().constructType(type.getType()).getRawClass();
		if (schema != null && rawClass.isRecord()) {
			Schema<?> model = schema.get$ref() == null ? schema
					: context.getDefinedModels().get(schema.get$ref().replace(SCHEMA_REF_PREFIX, ""));
			if (model != null && model.getProperties() != null) {
				markNonNullComponentsRequired(model, rawClass);
			}
		}
		return schema;
	}

	private static void markNonNullComponentsRequired(Schema<?> model, Class<?> record) {
		for (RecordComponent component : record.getRecordComponents()) {
			String name = component.getName();
			boolean nullable = component.getAnnotatedType().isAnnotationPresent(Nullable.class);
			boolean alreadyRequired = model.getRequired() != null && model.getRequired().contains(name);
			if (!nullable && !alreadyRequired && model.getProperties().containsKey(name)) {
				model.addRequiredItem(name);
			}
		}
	}

}
