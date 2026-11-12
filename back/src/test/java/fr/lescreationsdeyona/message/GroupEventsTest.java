package fr.lescreationsdeyona.message;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class GroupEventsTest {

	@Test
	void writesEachLineOfAGroupInFrench() {
		assertThat(AdminGroups.sentence("Léa Martin", GroupEvent.CREATED, "Boutique")).isEqualTo("Léa Martin a créé le groupe « Boutique »");
		assertThat(AdminGroups.sentence("Léa Martin", GroupEvent.RENAMED, "Atelier")).isEqualTo("Léa Martin a renommé le groupe « Atelier »");
		assertThat(AdminGroups.sentence("Léa Martin", GroupEvent.PHOTO_CHANGED, null)).isEqualTo("Léa Martin a changé la photo du groupe");
		assertThat(AdminGroups.sentence("Léa Martin", GroupEvent.PHOTO_REMOVED, null)).isEqualTo("Léa Martin a retiré la photo du groupe");
		assertThat(AdminGroups.sentence("Léa Martin", GroupEvent.ADDED, "sam@site.fr")).isEqualTo("Léa Martin a ajouté sam@site.fr");
		assertThat(AdminGroups.sentence("Léa Martin", GroupEvent.REMOVED, "sam@site.fr")).isEqualTo("Léa Martin a retiré sam@site.fr");
		assertThat(AdminGroups.sentence("sam@site.fr", GroupEvent.LEFT, null)).isEqualTo("sam@site.fr a quitté le groupe");
	}

	@Test
	void writesANewVersionWithoutAnyMember() {
		assertThat(AdminGroups.sentence(VersionAnnouncement.SITE, GroupEvent.VERSION, "2.14.0"))
			.isEqualTo("Nouvelle version de l'application disponible : version 2.14.0");
	}

}
