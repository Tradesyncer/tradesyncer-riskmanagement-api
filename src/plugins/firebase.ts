import Hapi from '@hapi/hapi';
import * as admin from 'firebase-admin';
import { badRequest, unauthorized } from '@hapi/boom';
import pkg from '../../package.json';
import { logger } from '../lib/grafana';

function firebaseAuthScheme(server: Hapi.Server, options: { instance: admin.app.App }) {
  return {

    authenticate(request: Hapi.Request, h: Hapi.ResponseToolkit) {

      // Get token from header
      const token = getToken(request);

      // If token not found, return an 'unauthorized' response
      if (token === null) {
        return unauthorized('token not found');
      }

      // This variable will hold Firebase's instance
      const firebaseInstance: admin.app.App = options.instance;

      // Validate token
      return validateToken(token, firebaseInstance, h);
    }
  }
}

function getToken(request: Hapi.Request): string | null {

  // Get authorization property from request header
  const authorizationHeader = request.headers.authorization;
  const requestAuthorization =
    typeof authorizationHeader === 'string' ? authorizationHeader : Array.isArray(authorizationHeader) ? authorizationHeader[0] : null;

  if (!requestAuthorization) return null;

  // Define a regular expression to match the case we want and test it
  const matchRegex = /(bearer)[ ]+(.*)/i;
  const resultMatch = requestAuthorization.match(matchRegex);

  // If no matches found, there is no token available
  if (!resultMatch) return null;

  // Match found! Return token
  return resultMatch[2] || null;
}

async function validateToken(token: string, firebaseInstance: admin.app.App, h: Hapi.ResponseToolkit) {

  // Verify token using Firebase's credentials
  return firebaseInstance.auth().verifyIdToken(token)
    .then(function (credentials) {

      credentials.user = { uid: credentials.uid, email: credentials.email };
      // Valid token!
      return h.authenticated({ credentials })

    }).catch(function (error) {

      logger.warn(`Firebase token validation failed: ${(error as Error).message}`);

      return badRequest('invalid_token');
    });
}

function register(server: Hapi.Server) {
  return server.auth.scheme('firebase', firebaseAuthScheme as any);
}

// export plugin
exports.plugin = {
  pkg,
  requirements: {
    hapi: '>=17.0.0'
  },
  register
};
