# Środowisko lokalne portalu – pliki pomocnicze

Tylko do uruchomienia portalu w środowisku z proxy HTTPS (sesja chmurowa zespołu): `Dockerfile.app` = `backend/docker/app/Dockerfile`
+ certyfikat proxy, apt przez https, ścieżki względem `portal/`. Na zwykłym komputerze (Mac/Linux) używaj oryginalnego
`backend/docker-compose.local.yml` – patrz `portal/README.md`. Certyfikat `proxy-ca.crt` nie trafia do repozytorium.
