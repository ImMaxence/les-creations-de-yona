package db.migration;

import fr.lescreationsdeyona.common.Texts;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

/**
 * Names saved before the services capitalized them all: ingredients (until now saved as typed),
 * and titles starting with an emoji, which V4's SQL left alone ("🍰 tarte" becomes "🍰 Tarte").
 * In Java to apply the very rule of the services ({@link Texts#capitalizeFirstLetter}): the first
 * letter or digit, whatever comes before it. updated_at is left as it is: no recipe changed.
 */
public class V8__capitalize_names extends BaseJavaMigration {

	/** Table and column of each name; fixed values, never from input. */
	private static final String[][] COLUMNS = { { "ingredient", "name" }, { "recipe", "title" },
			{ "category", "name" }, { "tag", "name" }, { "recipe_part", "title" } };

	@Override
	public void migrate(Context context) throws SQLException {
		Connection connection = context.getConnection();
		for (String[] column : COLUMNS) {
			capitalize(connection, column[0], column[1]);
		}
	}

	private static void capitalize(Connection connection, String table, String column) throws SQLException {
		try (Statement select = connection.createStatement();
				ResultSet rows = select.executeQuery("select id, " + column + " from " + table + " where " + column
						+ " is not null");
				PreparedStatement update = connection
					.prepareStatement("update " + table + " set " + column + " = ? where id = ?")) {
			while (rows.next()) {
				String value = rows.getString(2);
				String capitalized = Texts.capitalizeFirstLetter(value);
				if (!capitalized.equals(value)) {
					update.setString(1, capitalized);
					update.setLong(2, rows.getLong(1));
					update.addBatch();
				}
			}
			update.executeBatch();
		}
	}

}
