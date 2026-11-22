# Elasticsearch portalu (backend/docker/elasticsearch/Dockerfile) – wtyczki instalowane z plików pobranych wcześniej
# (w środowisku z proxy HTTPS Java w kontenerze nie ufa certyfikatowi proxy). Pliki: local/es-plugins/*.zip
FROM docker.elastic.co/elasticsearch/elasticsearch:6.8.23
RUN mkdir /usr/share/elasticsearch/config/hunspell && mkdir /usr/share/elasticsearch/config/synonyms
ADD ./backend/docker/elasticsearch/stopwords.txt /usr/share/elasticsearch/config
ADD ./backend/docker/elasticsearch/hunspell /usr/share/elasticsearch/config/hunspell
ADD ./backend/docker/elasticsearch/synonyms /usr/share/elasticsearch/config/synonyms
COPY ./local/es-plugins /tmp/es-plugins
RUN /usr/share/elasticsearch/bin/elasticsearch-plugin install -b file:///tmp/es-plugins/analysis-stempel-6.8.23.zip \
 && /usr/share/elasticsearch/bin/elasticsearch-plugin install -b file:///tmp/es-plugins/analysis-icu-6.8.23.zip && rm -rf /tmp/es-plugins
ADD ./backend/docker/elasticsearch/setup-logging.sh /usr/local/bin/setup-logging
RUN chmod 755 /usr/local/bin/setup-logging
COPY ./backend/docker/elasticsearch/elasticsearch.yml /usr/share/elasticsearch/config/elasticsearch.yml
