package fr.lescreationsdeyona.message;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class LinkPreviewsTest {

	private static final URI PAGE = URI.create("https://www.marmiton.org/recettes/tarte.aspx");

	private static LinkPages.Meta read(String html) {
		return LinkPages.read(html.getBytes(StandardCharsets.UTF_8), "text/html; charset=utf-8", PAGE);
	}

	@Test
	void readsTheOpenGraphTagsOfAPage() {
		LinkPages.Meta meta = read("""
				<html><head>
				<title>Titre de l'onglet</title>
				<meta property="og:title" content="Tarte au citron meringu&eacute;e">
				<meta content='Une p&acirc;te sabl&#233;e, un cr&#xE9;meux citron' property='og:description' />
				<meta property="og:image" content="/photos/tarte.jpg">
				<meta property="og:site_name" content="Marmiton">
				</head><body><meta property="og:title" content="Pas celui-ci"></body></html>""");

		assertThat(meta.title()).isEqualTo("Tarte au citron meringuée");
		assertThat(meta.description()).isEqualTo("Une pâte sablée, un crémeux citron");
		assertThat(meta.siteName()).isEqualTo("Marmiton");
		assertThat(meta.image()).isEqualTo(URI.create("https://www.marmiton.org/photos/tarte.jpg"));
	}

	@Test
	void fallsBackOnTheTitleAndDescriptionOfThePage() {
		LinkPages.Meta meta = read("""
				<head><TITLE>
				  Ma   page
				</TITLE><meta name="description" content="Ce qu'elle dit d'elle"><meta name="twitter:image" content="//cdn.site.fr/a.png"></head>""");

		assertThat(meta.title()).isEqualTo("Ma page");
		assertThat(meta.description()).isEqualTo("Ce qu'elle dit d'elle");
		assertThat(meta.siteName()).isEqualTo("marmiton.org");
		assertThat(meta.image()).isEqualTo(URI.create("https://cdn.site.fr/a.png"));
	}

	@Test
	void takesTheIconMadeForPhonesOfAPageWithoutImage() {
		LinkPages.Meta meta = read("""
				<head><title>Sans image</title>
				<link rel="icon" href="/favicon.png">
				<link rel="icon" type="image/svg+xml" href="/logo.svg">
				<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"></head>""");

		assertThat(meta.image()).isNull();
		assertThat(meta.icon()).isEqualTo(URI.create("https://www.marmiton.org/apple-touch-icon.png"));
		assertThat(read("<head><link rel=\"shortcut icon\" href=\"/f.png\"></head>").icon())
			.isEqualTo(URI.create("https://www.marmiton.org/f.png"));
	}

	@Test
	void readsAPageInTheEncodingItDeclares() {
		byte[] latin = "<head><meta charset=\"iso-8859-1\"><title>Crème brûlée</title></head>".getBytes(StandardCharsets.ISO_8859_1);

		assertThat(LinkPages.read(latin, "text/html", PAGE).title()).isEqualTo("Crème brûlée");
	}

	@Test
	void cutsALongTextAndLeavesOutAnImageOffTheWeb() {
		LinkPages.Meta meta = read("<head><meta property=\"og:description\" content=\"" + "a".repeat(600)
				+ "\"><meta property=\"og:image\" content=\"javascript:alert(1)\"></head>");

		assertThat(meta.description()).hasSize(LinkPages.MAX_DESCRIPTION).endsWith("…");
		assertThat(meta.image()).isNull();
	}

	@Test
	void findsTheFirstLinkOfAMessage() {
		assertThat(MessageTexts.firstLink("Regarde https://www.marmiton.org/recettes/tarte.aspx, elle est belle !"))
			.isEqualTo("https://www.marmiton.org/recettes/tarte.aspx");
		assertThat(MessageTexts.firstLink("(voir https://fr.wikipedia.org/wiki/Tarte_(cuisine))."))
			.isEqualTo("https://fr.wikipedia.org/wiki/Tarte_(cuisine)");
		assertThat(MessageTexts.firstLink("Tu as vu @[Tarte](RECIPE:2) ?")).isNull();
		assertThat(MessageTexts.firstLink("Rien ici")).isNull();
	}

	@Test
	void writesTheStartOfAMessageOnOneLine() {
		assertThat(MessageTexts.excerpt("Tu as vu\n@[Crème brûlée](RECIPE:2) ?", 140)).isEqualTo("Tu as vu @Crème brûlée ?");
		assertThat(MessageTexts.excerpt("un deux trois quatre", 12)).isEqualTo("un deux…");
	}

	@Test
	void readsOnlyWebAddresses() {
		assertThat(LinkPreviews.uriOf("https://site.fr/page")).isNotNull();
		assertThat(LinkPreviews.uriOf("ftp://site.fr/fichier")).isNull();
		assertThat(LinkPreviews.uriOf("https:///sans-hote")).isNull();
		assertThat(LinkPreviews.uriOf("pas une adresse")).isNull();
	}

	@Test
	void readsPublicAddressesOnly() throws UnknownHostException {
		for (String inside : new String[] { "127.0.0.1", "10.0.0.8", "172.20.1.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0",
				"::1", "fd00::1", "fe80::1", "::ffff:192.168.1.1", "64:ff9b::a00:1" }) {
			assertThat(LinkFetcher.isPublic(InetAddress.getByName(inside))).as(inside).isFalse();
		}
		for (String outside : new String[] { "93.184.216.34", "1.1.1.1", "2606:4700:4700::1111", "::ffff:8.8.8.8" }) {
			assertThat(LinkFetcher.isPublic(InetAddress.getByName(outside))).as(outside).isTrue();
		}
	}

	@Test
	void refusesAddressesOfTheServerOrWithAnotherPortOrALogin() {
		assertThatThrownBy(() -> LinkFetcher.requirePublic(URI.create("http://127.0.0.1/admin"))).isInstanceOf(IOException.class);
		assertThatThrownBy(() -> LinkFetcher.requirePublic(URI.create("http://localhost/"))).isInstanceOf(IOException.class);
		assertThatThrownBy(() -> LinkFetcher.requirePublic(URI.create("https://1.1.1.1:5432/"))).isInstanceOf(IOException.class);
		assertThatThrownBy(() -> LinkFetcher.requirePublic(URI.create("https://moi:secret@1.1.1.1/"))).isInstanceOf(IOException.class);
		assertThatThrownBy(() -> LinkFetcher.requirePublic(URI.create("file:///etc/passwd"))).isInstanceOf(IOException.class);
	}

}
