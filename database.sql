CREATE TYPE oauth_server_enum AS ENUM ('google');

CREATE TABLE users (
  PRIMARY KEY (oauth_server, id),
  oauth_server oauth_server_enum NOT NULL,
  id varchar(255) NOT NULL
);

CREATE TABLE diagrams (
  PRIMARY KEY (owner_oauth_server, owner_id, name),
  owner_oauth_server oauth_server_enum NOT NULL,
  owner_id varchar(255) NOT NULL,
  name varchar(255) NOT NULL,
  content bytea NOT NULL,
  FOREIGN KEY (owner_oauth_server, owner_id) REFERENCES users(oauth_server, id)
);
