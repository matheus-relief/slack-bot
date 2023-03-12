import { Keycloak } from 'keycloak-backend';

const keycloak = new Keycloak({
  realm: process.env.KEYCLOAK_REALM || '',
  keycloak_base_url: process.env.KEYCLOAK_AUTH_URL || '',
  client_id: process.env.KEYCLOAK_CLIENT_ID || '',
  username: process.env.KEYCLOAK_USERNAME || '',
  password: process.env.KEYCLOAK_PASSWORD || '',

  // This should be false if the keycloak version is under 18
  is_legacy_endpoint: false,
});

export const getOortToken = async () => {
  return await keycloak.accessToken.get();
};
