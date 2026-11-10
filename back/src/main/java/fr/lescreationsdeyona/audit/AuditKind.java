package fr.lescreationsdeyona.audit;

/** What it was done to. The trash's kinds have the same names. */
public enum AuditKind {
	RECIPE, CATEGORY, TAG, MENU, INGREDIENT, GLOSSARY_TERM, IMAGE, TRASH, APPEARANCE, SITE_CONTENT, SOCIAL_LINKS, BACKUP,
	GOOGLE_DRIVE, FEEDBACK, CAP_ENTRY,
	/** "Mes observations", gone in 2.4: kept for the history written before. */
	OBSERVATION, SHOP_SETTINGS, SHOP_PRODUCT, SHOP_ORDER, ACCOUNT_ENTRY, INVOICE
}
