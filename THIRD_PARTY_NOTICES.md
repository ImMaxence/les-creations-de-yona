# Composants de tiers

Les créations de Yona inclut les œuvres de tiers ci-dessous. Elles gardent leurs propres licences, qui ne changent pas avec la [licence du projet](LICENSE) ; celles qui l'exigent ont leur mention ici.

## Icônes : Lucide

Les icônes de l'interface (`front/src/app/shared/ui/icon/icons.ts`) sont reprises de [Lucide](https://lucide.dev).

```
ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT).
All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any purpose with or without
fee is hereby granted, provided that the above copyright notice and this permission notice appear
in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS
SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE
AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT,
NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.
```

```
The MIT License (MIT) — Feather

Copyright (c) 2013-2023 Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
associated documentation files (the "Software"), to deal in the Software without restriction,
including without limitation the rights to use, copy, modify, merge, publish, distribute,
sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or
substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES
OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## Logos : Simple Icons

Les logos des réseaux sociaux et des IA (`front/src/app/shared/ui/brand-icon/`, `front/src/app/shared/ui/ai-logo/`) viennent de [Simple Icons](https://simpleicons.org) (`simple-icons`), sous licence CC0 1.0 (domaine public). Les logos restent des marques de leurs propriétaires.

## Polices

Les polices des thèmes sont hébergées par le site (paquets `@fontsource-variable/*` de [Fontsource](https://fontsource.org), sous-ensembles latin et latin étendu, voir `front/scripts/generate-fonts.mjs`). Toutes sont sous **SIL Open Font License 1.1** : on peut les utiliser, les modifier et les redistribuer, y compris dans des pages web, à condition de ne pas les vendre seules et de garder la même licence pour une version modifiée, qui ne peut pas reprendre un nom réservé. Texte complet : https://openfontlicense.org/open-font-license-official-text/

| Police | Copyright |
| --- | --- |
| Bitter | © 2011 The Bitter Project Authors |
| Bodoni Moda | © 2020 The Bodoni Moda Project Authors |
| Bricolage Grotesque | © 2022 The Bricolage Grotesque Project Authors |
| Caveat | © 2014 The Caveat Project Authors |
| Cinzel | © 2020 The Cinzel Project Authors |
| Comfortaa | © 2011 The Comfortaa Project Authors, nom réservé « Comfortaa » |
| Cormorant Garamond | © 2015 The Cormorant Project Authors |
| Crimson Pro | © 2018 The Crimson Pro Project Authors |
| Dancing Script | © 2016 The Dancing Script Project Authors, nom réservé « Dancing Script » |
| DM Sans | © 2014 The DM Sans Project Authors |
| EB Garamond | © 2017 The EB Garamond Project Authors |
| Figtree | © 2022 The Figtree Project Authors |
| Fraunces | © 2020 The Fraunces Project Authors |
| Fredoka | © 2016 The Fredoka Project Authors |
| Grandstander | © 2020 The Grandstander Project Authors |
| Imbue | © 2020 The Imbue Project Authors |
| Inter | © 2016 The Inter Project Authors |
| Josefin Sans | © 2010 The Josefin Sans Project Authors, nom réservé « Josefin Sans » |
| Kalnia | © 2022 The Kalnia Project Authors |
| Lora | © 2011 The Lora Project Authors, nom réservé « Lora » |
| Manrope | © 2019 The Manrope Project Authors |
| Merriweather | © 2024 The Merriweather Project Authors, nom réservé « Merriweather » |
| Montserrat | © 2011 The Montserrat Project Authors |
| Newsreader | © 2020 The Newsreader Project Authors |
| Nunito | © 2014 The Nunito Project Authors |
| Open Sans | © 2020 The Open Sans Project Authors |
| Outfit | © 2021 The Outfit Project Authors |
| Playfair Display | © 2017 The Playfair Display Project Authors, nom réservé « Playfair Display » |
| Playpen Sans | © 2023 The Playpen Sans Project Authors |
| Quicksand | © 2019 The Quicksand Project Authors, nom réservé « Quicksand » |
| Raleway | © 2010 The Raleway Project Authors, nom réservé « Raleway » |
| Rubik | © 2015 The Rubik Project Authors |
| Shantell Sans | © 2022 The Shantell Sans Project Authors |
| Source Sans 3 | © 2010-2020 Adobe, nom réservé « Source » |
| Syne | © 2019 The Syne Project Authors |
| Unbounded | © 2022 The Unbounded Project Authors |
| Work Sans | © 2019 The Work Sans Project Authors |

## Bibliothèques du site

Le front embarque ces bibliothèques ; leurs licences sont fournies avec leurs paquets dans `node_modules`.

- **Angular** et **Angular CDK** : MIT, © Google LLC
- **marked** (étapes en Markdown) : MIT, © 2018+ MarkedJS, © 2011-2018 Christopher Jeffrey
- **turndown** (HTML collé vers Markdown) : MIT, © 2017 Dom Christie
- **Transformers.js** (`@huggingface/transformers`, IA locale) : Apache License 2.0, © Hugging Face
- **ONNX Runtime Web** (`onnxruntime-web`, son WebAssembly est servi par le site sous `/ort/`) : MIT, © Microsoft Corporation
- **RxJS** : Apache License 2.0, © Google, Inc., Netflix, Inc., Microsoft Corp. and contributors
- **tslib** : 0BSD, © Microsoft Corporation
- **Express** (serveur du rendu côté serveur) : MIT, © TJ Holowaychuk, Roman Shtylman, Douglas Christopher Wilson

Le serveur utilise (Maven, licences dans leurs jars) :

- Spring Boot, Spring Framework, Spring Security, Hibernate, Flyway, springdoc-openapi, Caffeine, MapStruct : Apache License 2.0
- **Pilote JDBC PostgreSQL** : BSD 2-Clause, © PostgreSQL Global Development Group
- **AWS SDK for Java 2.x** (stockage des photos) : Apache License 2.0, © Amazon.com, Inc. or its affiliates
- **Anthropic Java SDK** : Apache License 2.0, © Anthropic, PBC
- **TwelveMonkeys ImageIO** (lecture des JPEG) : BSD 3-Clause, © Harald Kuhr
- **metadata-extractor** (métadonnées des photos) : Apache License 2.0, © Drew Noakes
- **webp-imageio** (écriture des WebP) : Apache License 2.0, avec libwebp, BSD 3-Clause, © Google Inc.
- **Maven Wrapper** (`back/mvnw`, `back/mvnw.cmd`) : Apache License 2.0, © The Apache Software Foundation

## Données

- **Ciqual**, table de composition nutritionnelle des aliments : Licence Ouverte / Etalab 2.0, © Anses (<https://ciqual.anses.fr>), version 2025 du 19/11/2025. Installée dans la base par la migration V32 (`back/src/main/resources/db/migration/V32__nutrition_ciqual.sql`) ; la source est citée sous les valeurs et dans les mentions légales
- **Open Food Facts** : base sous Open Database License (ODbL) 1.0, contenus sous Database Contents License 1.0, © les contributeurs d'Open Food Facts (<https://world.openfoodfacts.org>). Le site ne la copie pas : le backend l'interroge quand Yona cherche un produit dans le back-office
- **Nutri-Score** est une marque de Santé publique France. Le site affiche une estimation calculée avec l'algorithme 2023, pas le logo officiel

## Modèles d'IA

Les modèles de l'IA locale ne sont pas dans ce dépôt et le site ne les distribue pas : le navigateur les télécharge directement depuis Hugging Face (voir [docs/ia.md](docs/ia.md)).

- **Gemma 4 E4B** de Google : Apache License 2.0
- **FLUX.2 klein 4B** de Black Forest Labs et **Qwen3 4B** d'Alibaba : Apache License 2.0
- **Whisper large-v3-turbo** d'OpenAI : MIT
