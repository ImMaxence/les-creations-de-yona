# Restaurer une sauvegarde

Procédure pour remettre le site dans l'état d'une archive téléchargée depuis le back-office (bouton « Sauvegarder mes données »). Elle sert après une perte de données, une fausse manipulation ou pour remonter le site sur un nouveau serveur.

Testée le 2026-10-21 sur la stack locale : base remise à l'état de la sauvegarde, image supprimée restaurée, backend redémarré sans erreur (Flyway valide le schéma).

## Contenu de l'archive

| Fichier | Contenu |
| --- | --- |
| `database.dump` | Toute la base PostgreSQL (`pg_dump`, format custom), historique Flyway compris |
| `images/{clé S3}` | Tout le bucket S3, par exemple `images/recipes/{uuid}/800.webp` |

## Avant de commencer

- Un accès SSH au serveur (ou la machine locale), avec Docker.
- La stack déployée et démarrée : PostgreSQL et SeaweedFS tournent, le bucket existe (créé au démarrage de SeaweedFS). Sur un nouveau serveur, déployer d'abord le site, base vide comprise.
- Les admins devront se reconnecter : les sessions sont en mémoire.

Les commandes sont écrites pour un shell Linux (serveur, WSL ou Git Bash).

## 1. Déposer et décompresser l'archive

```bash
scp sauvegarde.zip serveur:~/                 # depuis la machine qui a l'archive
unzip sauvegarde.zip -d ~/restauration
```

## 2. Repérer les conteneurs

```bash
docker ps --format '{{.Names}}'
```

Reporter les noms affichés (en local : `les-creations-de-yona-postgres-1`, etc. ; sur Coolify ils se terminent par un identifiant) :

```bash
POSTGRES=les-creations-de-yona-postgres-1
SEAWEEDFS=les-creations-de-yona-seaweedfs-1
BACK=les-creations-de-yona-back-1
```

## 3. Arrêter le backend

Plus aucune écriture pendant la restauration :

```bash
docker stop "$BACK"
```

## 4. Restaurer la base

```bash
docker cp ~/restauration/database.dump "$POSTGRES":/tmp/database.dump
docker exec "$POSTGRES" sh -c 'pg_restore --clean --if-exists --no-owner --single-transaction --exit-on-error \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" /tmp/database.dump'
docker exec "$POSTGRES" rm /tmp/database.dump
```

- `--clean --if-exists` : supprime puis recrée chaque table, que la base soit vide ou non.
- `--single-transaction --exit-on-error` : tout ou rien. Si une erreur survient, la base reste telle qu'avant la commande.
- `--no-owner` : les objets appartiennent à l'utilisateur de la base cible, même s'il a changé de nom.
- Le client `pg_restore` est celui du conteneur PostgreSQL : même version (18) que le `pg_dump` du backend.

## 5. Restaurer les images

Les identifiants S3 sont relus dans la configuration du backend arrêté, sans les taper ni les afficher :

```bash
while IFS='=' read -r key value; do export "$key=$value"; done < <(
  docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$BACK" \
    | grep -E '^S3_(ACCESS_KEY|SECRET_KEY|BUCKET)=')

docker run --rm --network "container:$SEAWEEDFS" \
  -v ~/restauration/images:/images:ro \
  -e AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY" -e AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY" -e AWS_DEFAULT_REGION=us-east-1 \
  amazon/aws-cli:2.38.3 --endpoint-url http://127.0.0.1:8333 \
  s3 sync /images "s3://$S3_BUCKET/"
```

- `--network "container:$SEAWEEDFS"` : le client S3 partage le réseau de SeaweedFS et l'atteint sur `127.0.0.1:8333`, sans publier de port ni chercher le nom du réseau Docker.
- `s3 sync` n'envoie que les fichiers absents ou différents, et ne supprime rien : des images en trop resteraient en orphelines, sans effet sur le site.

## 6. Redémarrer et vérifier

```bash
docker start "$BACK"
docker ps --filter name="$BACK" --format '{{.Status}}'   # attendre « (healthy) »
```

- Le site affiche les recettes de la sauvegarde, avec leurs photos.
- Le back-office s'ouvre après reconnexion Google.

## 7. Nettoyer

L'archive contient toutes les données du site :

```bash
rm -rf ~/restauration ~/sauvegarde.zip
unset S3_ACCESS_KEY S3_SECRET_KEY S3_BUCKET
```
