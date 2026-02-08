import express from 'express';
import cors from 'cors';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialisation de l'application Express
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Active CORS pour les requêtes cross-origin
app.use(express.json()); // Parse les requêtes JSON

// ============== CONFIGURATION FIREBASE ==============
let db = null;
let useFirebase = false;

// Tente d'initialiser Firebase Firestore
let firebaseCredentials = null;

// Priorité 1: Lire depuis la variable d'environnement (pour Railway)
if (process.env.FIREBASE_CREDENTIALS_JSON) {
  try {
    firebaseCredentials = JSON.parse(process.env.FIREBASE_CREDENTIALS_JSON);
  } catch (err) {
    console.error('Erreur parsing FIREBASE_CREDENTIALS_JSON:', err.message);
  }
}

// Priorité 2: Lire depuis le fichier local (pour développement local)
if (!firebaseCredentials) {
  const serviceAccountPath = path.join(__dirname, './serviceAccountKey.json');
  if (fs.existsSync(serviceAccountPath)) {
    try {
      const fileContent = fs.readFileSync(serviceAccountPath, 'utf8');
      firebaseCredentials = JSON.parse(fileContent);
    } catch (err) {
      console.error('Erreur lecture serviceAccountKey.json:', err.message);
    }
  }
}

// Initialiser Firebase si les credentials sont disponibles
if (firebaseCredentials) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(firebaseCredentials),
    });
    db = admin.firestore();
    useFirebase = true;
    console.log('✓ Firebase Firestore initialisé');
  } catch (err) {
    console.log('  Firebase non disponible, utilisation du fichier JSON');
  }
} else {
  console.log('  serviceAccountKey.json non trouvé, utilisation du fichier JSON');
}

// ============== CHARGEMENT DES DONNÉES ==============
const seedDataPath = path.join(__dirname, '../../seedData.json');
let seedData = {};

// Charge les données initiales depuis seedData.json
try {
  const data = fs.readFileSync(seedDataPath, 'utf8');
  seedData = JSON.parse(data);
  console.log('✓ Données JSON chargées');
} catch (err) {
  console.error('✗ Erreur: seedData.json non trouvé');
}

// ============== ENDPOINTS VOITURES ==============

// GET tous les voitures
app.get('/api/voitures', async (req, res) => {
  try {
    let voitures;

    if (useFirebase) {
      const snapshot = await db.collection('voitures').get();
      voitures = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    } else {
      voitures = seedData.voitures || [];
    }

    res.json(voitures);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET voiture par ID
app.get('/api/voitures/:id', async (req, res) => {
  try {
    let voiture;

    if (useFirebase) {
      const doc = await db.collection('voitures').doc(req.params.id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Voiture non trouvée' });
      }
      voiture = { _id: doc.id, ...doc.data() };
    } else {
      voiture = seedData.voitures.find(v => v._id === req.params.id);
      if (!voiture) {
        return res.status(404).json({ error: 'Voiture non trouvée' });
      }
    }

    res.json(voiture);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============== ENDPOINTS CLIENTS ==============

// GET tous les clients
app.get('/api/clients', async (req, res) => {
  try {
    let clients;

    if (useFirebase) {
      const snapshot = await db.collection('clients').get();
      clients = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    } else {
      clients = seedData.clients || [];
    }

    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET client par ID
app.get('/api/clients/:id', async (req, res) => {
  try {
    let client;

    if (useFirebase) {
      const doc = await db.collection('clients').doc(req.params.id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Client non trouvé' });
      }
      client = { _id: doc.id, ...doc.data() };
    } else {
      client = seedData.clients.find(c => c._id === req.params.id);
      if (!client) {
        return res.status(404).json({ error: 'Client non trouvé' });
      }
    }

    res.json(client);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============== ENDPOINTS PROPRIÉTAIRES ==============

// GET tous les propriétaires
app.get('/api/proprietaires', async (req, res) => {
  try {
    let proprietaires;

    if (useFirebase) {
      const snapshot = await db.collection('proprietaires').get();
      proprietaires = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    } else {
      proprietaires = seedData.proprietaires || [];
    }

    res.json(proprietaires);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============== ENDPOINTS RÉPARATIONS ==============

// GET toutes les réparations
app.get('/api/reparations', async (req, res) => {
  try {
    let reparations;

    if (useFirebase) {
      const snapshot = await db.collection('reparations').get();
      reparations = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    } else {
      reparations = seedData.reparations || [];
    }

    res.json(reparations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET réparations par voiture
app.get('/api/reparations/voiture/:voitureId', async (req, res) => {
  try {
    let reparations;

    if (useFirebase) {
      const snapshot = await db.collection('reparations')
        .where('voiture._id', '==', req.params.voitureId)
        .get();
      reparations = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    } else {
      reparations = (seedData.reparations || []).filter(
        r => (r.voiture?._id === req.params.voitureId)
      );
    }

    res.json(reparations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============== ENDPOINTS FIN RÉPARATION ==============

// GET toutes les fins de réparation
app.get('/api/finReparation', async (req, res) => {
  try {
    let finReparations;

    if (useFirebase) {
      const snapshot = await db.collection('finReparationPieces').get();
      finReparations = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    } else {
      finReparations = seedData.finReparationPieces || [];
    }

    res.json(finReparations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============== ENDPOINTS TYPES & PIÈCES ==============

// GET tous les types de voiture
app.get('/api/types-voiture', async (req, res) => {
  try {
    let types;

    if (useFirebase) {
      const snapshot = await db.collection('typesVoiture').get();
      types = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    } else {
      types = seedData.typesVoiture || [];
    }

    res.json(types);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET toutes les pièces réparables
app.get('/api/pieces', async (req, res) => {
  try {
    let pieces;

    if (useFirebase) {
      const snapshot = await db.collection('piecesReparables').get();
      pieces = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    } else {
      pieces = seedData.piecesReparables || [];
    }

    res.json(pieces);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============== ENDPOINT SANTÉ ==============

// GET vérifier l'état du serveur
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Serveur Node.js fonctionne correctement',
    firebaseConnected: useFirebase,
    dataAvailable: {
      voitures: seedData.voitures ? seedData.voitures.length : 0,
      clients: seedData.clients ? seedData.clients.length : 0,
      proprietaires: seedData.proprietaires ? seedData.proprietaires.length : 0,
      reparations: seedData.reparations ? seedData.reparations.length : 0,
      finReparationPieces: seedData.finReparationPieces ? seedData.finReparationPieces.length : 0,
      pieces: seedData.piecesReparables ? seedData.piecesReparables.length : 0
    }
  });
});

// ============== GESTION DES ERREURS ==============

// Route 404 - Endpoint non trouvé
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// ============== DÉMARRAGE DU SERVEUR ==============

app.listen(PORT, () => {
  console.log(`🚀 Serveur Node.js démarré sur http://localhost:${PORT}`);
  console.log(`🔥 Firebase: ${useFirebase ? '✅ Connecté' : '❌ Non disponible'}`);
});

// ============== GESTION DES ERREURS NON CAPTURÉES ==============

process.on('unhandledRejection', (err) => {
  console.error('Erreur non gérée:', err);
});
