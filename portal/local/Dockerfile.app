FROM python:3.8.20-bullseye
# --- środowisko lokalne (CR-TL-9): sieć tylko przez proxy HTTPS z własnym certyfikatem ---
ARG HTTPS_PROXY
ARG https_proxy
COPY local/proxy-ca.crt /usr/local/share/ca-certificates/proxy-ca.crt
RUN cat /usr/local/share/ca-certificates/proxy-ca.crt >> /etc/ssl/certs/ca-certificates.crt
ENV REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt PIP_CERT=/etc/ssl/certs/ca-certificates.crt NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt

ARG UID=1000
ARG GID=1000
ARG UNAME=mcod

ENV PYTHONUNBUFFERED=1

RUN printf '%s\n' \
    'deb [check-valid-until=no] https://snapshot.debian.org/archive/debian/20240926T000000Z bullseye main contrib non-free' \
    'deb [check-valid-until=no] https://snapshot.debian.org/archive/debian-security/20240926T000000Z bullseye-security main contrib non-free' \
    'deb [check-valid-until=no] https://snapshot.debian.org/archive/debian/20240926T000000Z bullseye-updates main contrib non-free' \
    > /etc/apt/sources.list
RUN apt-get -o Acquire::Check-Valid-Until=false update && apt-get install -y --allow-unauthenticated \
    gettext \
    locales \
    libarchive13 \
    libmagickcore-6.q16-3-extra \
    curl \
    dirmngr \
    apt-transport-https \
    lsb-release \
    ca-certificates \
    firefox-esr \
    ffmpeg \
    unrar \
    libxmlsec1-dev

RUN curl -sL https://deb.nodesource.com/setup_16.x | bash -

RUN apt-get install -y nodejs

RUN sed -i '/en_GB.UTF-8/s/^# //g' /etc/locale.gen
RUN sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen
RUN sed -i '/pl_PL.UTF-8/s/^# //g' /etc/locale.gen
RUN locale-gen

ENV LANG=pl_PL.UTF-8
ENV LANGUAGE=pl_PL:pl
ENV LC_ALL=pl_PL.UTF-8

ENV OPENSSL_CONF=/etc/ssl/

RUN npm install -g geckodriver --unsafe-perm

RUN groupadd -g $GID -o $UNAME
RUN useradd -m -u $UID -g $GID -o -s /bin/bash $UNAME

WORKDIR /usr/src/mcod_backend

RUN pip install -I setuptools"<58" "pipenv==2022.10.12"

ADD backend/Pipfile.lock /usr/src/mcod_backend/Pipfile.lock
ADD backend/Pipfile      /usr/src/mcod_backend/Pipfile
ADD backend/django_suit-0.2.28-py3-none-any.whl      /usr/src/mcod_backend/django_suit-0.2.28-py3-none-any.whl
ADD backend/hypereditor-0.1.0-py3-none-any.whl       /usr/src/mcod_backend/hypereditor-0.1.0-py3-none-any.whl
RUN pipenv --verbose install --deploy --system

COPY backend/docker/wait-for-it.sh /usr/local/bin/wait-for-it
RUN chmod +x /usr/local/bin/wait-for-it

COPY backend/docker/app/start-api.sh /usr/local/bin/start-api
RUN chmod +x /usr/local/bin/start-api

COPY backend/docker/app/start-django.sh /usr/local/bin/start-django
RUN chmod +x /usr/local/bin/start-django

COPY backend/docker/app/start-celery.sh /usr/local/bin/start-celery
RUN chmod +x /usr/local/bin/start-celery

COPY backend/docker/app/start-celery-local.sh /usr/local/bin/start-celery-local
RUN chmod +x /usr/local/bin/start-celery-local

# TODO: limit the context here to only the required paths
ADD backend /usr/src/mcod_backend

# Compile translations and cleanup pyc files afterwards
RUN mkdir -p /usr/src/mcod_backend/logs && python manage.py compilemessages --settings mcod.settings.test -v 3
RUN find /usr/src/mcod_backend -name '*.pyc' -delete

EXPOSE 8001 5678
