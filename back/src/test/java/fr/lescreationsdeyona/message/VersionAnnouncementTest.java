package fr.lescreationsdeyona.message;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class VersionAnnouncementTest {

	@Test
	void tellsTheFirstVersionEver() {
		assertThat(VersionAnnouncement.isNewest("2.14.0", List.of())).isTrue();
	}

	@Test
	void tellsAVersionNewerThanEveryOneTold() {
		assertThat(VersionAnnouncement.isNewest("2.14.0", List.of("2.13.0", "2.13.1"))).isTrue();
		assertThat(VersionAnnouncement.isNewest("2.14.1", List.of("2.14.0"))).isTrue();
		assertThat(VersionAnnouncement.isNewest("3.0.0", List.of("2.99.99"))).isTrue();
	}

	@Test
	void comparesNumberByNumberNotAsText() {
		assertThat(VersionAnnouncement.isNewest("2.10.0", List.of("2.9.3"))).isTrue();
		assertThat(VersionAnnouncement.isNewest("2.9.3", List.of("2.10.0"))).isFalse();
	}

	@Test
	void tellsNothingAgainWhenTheSameVersionStartsAgain() {
		assertThat(VersionAnnouncement.isNewest("2.14.0", List.of("2.13.0", "2.14.0"))).isFalse();
	}

	@Test
	void tellsNothingWhenAnOlderVersionComesBack() {
		assertThat(VersionAnnouncement.isNewest("2.14.0", List.of("2.15.0"))).isFalse();
	}

	@Test
	void tellsOnlyAReleasedVersion() {
		assertThat(VersionAnnouncement.isRelease("2.14.0")).isTrue();
		assertThat(VersionAnnouncement.isRelease("dev")).isFalse();
		assertThat(VersionAnnouncement.isRelease("2.14.0-SNAPSHOT")).isFalse();
		assertThat(VersionAnnouncement.isRelease("2.14")).isFalse();
	}

	@Test
	void leavesOutWhatIsNoVersion() {
		assertThat(VersionAnnouncement.isNewest("2.14.0", List.of("dev", "2.13.0-SNAPSHOT"))).isTrue();
	}

}
