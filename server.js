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

// POST créer une nouvelle voiture
// body: { marque, proprietaireId, typeId }
app.post('/api/voitures', async (req, res) => {
  try {
    const { marque, proprietaireId, typeId } = req.body;

    if (!marque || !proprietaireId || !typeId) {
      return res.status(400).json({
        error: 'marque, proprietaireId et typeId sont requis'
      });
    }

    if (useFirebase) {
      // Récupérer les données du propriétaire et du type
      const propDoc = await db.collection('proprietaires').doc(proprietaireId).get();
      const typeDoc = await db.collection('typesVoiture').doc(typeId).get();

      if (!propDoc.exists) {
        return res.status(404).json({ error: 'Propriétaire non trouvé' });
      }
      if (!typeDoc.exists) {
        return res.status(404).json({ error: 'Type de voiture non trouvé' });
      }

      const now = new Date();
      const voiture = {
        marque,
        proprietaire: {
          _id: proprietaireId,
          nom: propDoc.data().nom,
          prenom: propDoc.data().prenom
        },
        type: {
          _id: typeId,
          nomType: typeDoc.data().nomType
        },
        reparations: [],
        createdAt: now,
        updatedAt: now
      };

      // Créer un nouvel ID pour la voiture
      const docRef = await db.collection('voitures').add(voiture);
      const doc = await docRef.get();
      return res.json({ _id: doc.id, ...doc.data() });
    } else {
      return res.status(400).json({ error: 'Firebase non disponible' });
    }
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

// GET propriétaire par ID
app.get('/api/proprietaires/:id', async (req, res) => {
  try {
    let proprietaire;

    if (useFirebase) {
      const doc = await db.collection('proprietaires').doc(req.params.id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Propriétaire non trouvé' });
      }
      proprietaire = { _id: doc.id, ...doc.data() };
    } else {
      const all = seedData.proprietaires || [];
      proprietaire = all.find(p => p._id === req.params.id);
      if (!proprietaire) {
        return res.status(404).json({ error: 'Propriétaire non trouvé' });
      }
    }

    res.json(proprietaire);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST créer/inscrire un nouveau propriétaire (login/signup)
// body: { uid, email, nom, prenom }
// uid = id Firebase Auth
app.post('/api/proprietaires', async (req, res) => {
  try {
    const { uid, email, nom, prenom } = req.body;

    if (!uid || !email || !nom || !prenom) {
      return res.status(400).json({
        error: 'uid, email, nom et prenom sont requis'
      });
    }

    if (useFirebase) {
      const now = new Date();
      const proprietaire = {
        email,
        nom,
        prenom,
        voitures: [],
        createdAt: now,
        updatedAt: now
      };

      // Créer le document avec l'uid Firebase comme ID
      await db.collection('proprietaires').doc(uid).set(proprietaire);
      const doc = await db.collection('proprietaires').doc(uid).get();
      return res.json({ _id: doc.id, ...doc.data() });
    } else {
      return res.status(400).json({ error: 'Firebase non disponible' });
    }
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

// GET une réparation par ID
app.get('/api/reparations/:id', async (req, res) => {
  try {
    const id = req.params.id;
    let reparation = null;

    if (useFirebase) {
      const doc = await db.collection('reparations').doc(id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Réparation non trouvée' });
      }
      reparation = { _id: doc.id, ...doc.data() };
    } else {
      const all = seedData.reparations || [];
      reparation = all.find(r =>
        r._id === id ||
        r.id === id ||
        r.code === id ||
        r.idReparation === id
      );
      if (!reparation) {
        return res.status(404).json({ error: 'Réparation non trouvée' });
      }
    }

    res.json(reparation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST créer une nouvelle réparation
// body: { voiture, pieces, statut, description, dateDebut }
app.post('/api/reparations', async (req, res) => {
  try {
    const { voiture, pieces, statut, description, dateDebut } = req.body;

    if (!voiture || !voiture._id) {
      return res.status(400).json({
        error: 'Le champ voiture avec _id est requis'
      });
    }

    if (useFirebase) {
      // Générer un ID séquentiel REP-XXX
      const reparationsSnapshot = await db.collection('reparations').get();
      let maxId = 0;
      
      reparationsSnapshot.docs.forEach(doc => {
        const docId = doc.id;
        if (docId.startsWith('REP-')) {
          const num = parseInt(docId.replace('REP-', ''), 10);
          if (num > maxId) maxId = num;
        }
      });

      const newId = `REP-${String(maxId + 1).padStart(3, '0')}`;

      const now = new Date();
      const reparation = {
        _id: newId,
        voiture,
        pieces: pieces || [],
        statut: statut || 'EN_ATTENTE',
        description: description || '',
        dateDebut: dateDebut ? new Date(dateDebut) : now,
        createdAt: now,
        updatedAt: now
      };

      await db.collection('reparations').doc(newId).set(reparation);
      const doc = await db.collection('reparations').doc(newId).get();
      return res.json({ _id: doc.id, ...doc.data() });
    } else {
      // Mode JSON local
      const reparations = seedData.reparations || [];
      const maxId = reparations.reduce((max, r) => {
        if (r._id && r._id.startsWith('REP-')) {
          const num = parseInt(r._id.replace('REP-', ''), 10);
          return num > max ? num : max;
        }
        return max;
      }, 0);

      const newId = `REP-${String(maxId + 1).padStart(3, '0')}`;
      const newReparation = {
        _id: newId,
        voiture,
        pieces: pieces || [],
        statut: statut || 'EN_ATTENTE',
        description: description || '',
        dateDebut: dateDebut ? new Date(dateDebut) : new Date()
      };

      reparations.push(newReparation);
      seedData.reparations = reparations;

      try {
        fs.writeFileSync(seedDataPath, JSON.stringify(seedData, null, 2), 'utf8');
      } catch (err) {
        console.error('Erreur écriture seedData.json:', err);
      }

      return res.json(newReparation);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT mettre à jour le statut d'une réparation
app.put('/api/reparations/:id', async (req, res) => {
  try {
    const { statut } = req.body;

    if (!statut) {
      return res.status(400).json({ error: 'Le champ statut est requis' });
    }

    if (useFirebase) {
      await db.collection('reparations').doc(req.params.id).update({ statut });
      const doc = await db.collection('reparations').doc(req.params.id).get();
      return res.json({ _id: doc.id, ...doc.data() });
    } else {
      const all = seedData.reparations || [];
      const reparation = all.find(r => r._id === req.params.id);
      if (!reparation) {
        return res.status(404).json({ error: 'Réparation non trouvée' });
      }
      reparation.statut = statut;
      return res.json(reparation);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

// GET toutes les finReparationPieces (route principale sans paramètres)
app.get('/api/finReparationPieces', async (req, res) => {
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

// GET fins de réparation pour une réparation donnée
app.get('/api/finReparationPieces/reparation/:reparationId', async (req, res) => {
  try {
    let finReparations;

    if (useFirebase) {
      const snapshot = await db
        .collection('finReparationPieces')
        .where('reparation._id', '==', req.params.reparationId)
        .get();
      finReparations = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    } else {
      const all = seedData.finReparationPieces || [];
      finReparations = all.filter(fr => fr.reparation && fr.reparation._id === req.params.reparationId);
    }

    res.json(finReparations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET une fin de réparation par ID
app.get('/api/finReparationPieces/:id', async (req, res) => {
  try {
    let finReparation;

    if (useFirebase) {
      const doc = await db.collection('finReparationPieces').doc(req.params.id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Fin de réparation non trouvée' });
      }
      finReparation = { _id: doc.id, ...doc.data() };
    } else {
      const all = seedData.finReparationPieces || [];
      finReparation = all.find(fr => fr._id === req.params.id);
      if (!finReparation) {
        return res.status(404).json({ error: 'Fin de réparation non trouvée' });
      }
    }

    res.json(finReparation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST créer une nouvelle fin de réparation pour une pièce
app.post('/api/finReparationPieces', async (req, res) => {
  try {
    const { reparation, piece, dateFinReparation } = req.body;

    if (!reparation || !piece || !dateFinReparation) {
      return res.status(400).json({
        error: 'reparation, piece et dateFinReparation sont requis'
      });
    }

    if (useFirebase) {
      const docRef = await db.collection('finReparationPieces').add({
        reparation,
        piece,
        dateFinReparation: new Date(dateFinReparation),
        createdAt: new Date()
      });
      const doc = await docRef.get();
      return res.json({ _id: doc.id, ...doc.data() });
    } else {
      return res.status(400).json({ error: 'Firebase non disponible' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT mettre à jour la date de fin
app.put('/api/finReparationPieces/:id', async (req, res) => {
  try {
    const { dateFinReparation } = req.body;

    if (!dateFinReparation) {
      return res.status(400).json({ error: 'Le champ dateFinReparation est requis' });
    }

    if (useFirebase) {
      await db.collection('finReparationPieces').doc(req.params.id).update({
        dateFinReparation: new Date(dateFinReparation),
        updatedAt: new Date()
      });
      const doc = await db.collection('finReparationPieces').doc(req.params.id).get();
      return res.json({ _id: doc.id, ...doc.data() });
    } else {
      return res.status(400).json({ error: 'Firebase non disponible' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE fin de réparation individuelle
app.delete('/api/finReparationPieces/:id', async (req, res) => {
  try {
    if (useFirebase) {
      await db.collection('finReparationPieces').doc(req.params.id).delete();
      return res.json({ message: 'Fin de réparation supprimée avec succès' });
    } else {
      return res.status(400).json({ error: 'Firebase non disponible' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE COMPLET finReparationPieces
app.delete('/api/finReparationPieces', async (req, res) => {
  try {
    if (!useFirebase) {
      return res.status(400).json({ error: 'Firebase non disponible' });
    }

    const snap = await db.collection('finReparationPieces').get();

    if (snap.empty) {
      return res.json({ message: 'Aucun document à supprimer', deleted: 0 });
    }

    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    res.json({ message: 'Tous les finReparationPieces ont été supprimés', deleted: snap.size });
  } catch (err) {
    console.error('Erreur suppression finReparationPieces:', err);
    res.status(500).json({ error: err.message });
  }
});

// RESET COMPLET finReparationPieces
app.get('/api/finReparationPieces/reset', async (req, res) => {
  try {
    let deletedCount = 0;

    if (useFirebase && db) {
      const snap = await db.collection('finReparationPieces').get();
      if (!snap.empty) {
        const batch = db.batch();
        snap.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        deletedCount = snap.size;
      }
      return res.json({
        message: 'finReparationPieces vidé complètement',
        mode: 'firebase',
        deleted: deletedCount
      });
    } else {
      if (Array.isArray(seedData.finReparationPieces)) {
        deletedCount = seedData.finReparationPieces.length;
        seedData.finReparationPieces = [];
        try {
          fs.writeFileSync(seedDataPath, JSON.stringify(seedData, null, 2), 'utf8');
        } catch (err) {
          console.error('Erreur écriture seedData.json :', err);
        }
      }
      return res.json({
        message: 'finReparationPieces vidé complètement',
        mode: 'json',
        deleted: deletedCount
      });
    }
  } catch (err) {
    console.error('Erreur reset finReparationPieces:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============== ENDPOINTS HISTORIQUE PAIEMENT ==============

// GET tous les paiements
app.get('/api/historiquePaiement', async (req, res) => {
  try {
    let paiements;

    if (useFirebase) {
      const snapshot = await db.collection('historiquePaiement').get();
      paiements = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    } else {
      paiements = seedData.historiquePaiement || [];
    }

    res.json(paiements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET un paiement par ID
app.get('/api/historiquePaiement/:id', async (req, res) => {
  try {
    let paiement;

    if (useFirebase) {
      const doc = await db.collection('historiquePaiement').doc(req.params.id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Paiement non trouvé' });
      }
      paiement = { _id: doc.id, ...doc.data() };
    } else {
      const all = seedData.historiquePaiement || [];
      paiement = all.find(p => p._id === req.params.id);
      if (!paiement) {
        return res.status(404).json({ error: 'Paiement non trouvé' });
      }
    }

    res.json(paiement);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET paiements par réparation
app.get('/api/historiquePaiement/reparation/:reparationId', async (req, res) => {
  try {
    let paiements;

    if (useFirebase) {
      const snapshot = await db.collection('historiquePaiement')
        .where('reparationId', '==', req.params.reparationId)
        .get();
      paiements = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    } else {
      const all = seedData.historiquePaiement || [];
      paiements = all.filter(p => p.reparationId === req.params.reparationId);
    }

    res.json(paiements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET paiements par client
app.get('/api/historiquePaiement/client/:clientId', async (req, res) => {
  try {
    let paiements;

    if (useFirebase) {
      const snapshot = await db.collection('historiquePaiement')
        .where('clientId', '==', req.params.clientId)
        .get();
      paiements = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    } else {
      const all = seedData.historiquePaiement || [];
      paiements = all.filter(p => p.clientId === req.params.clientId);
    }

    res.json(paiements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST créer un nouveau paiement
app.post('/api/historiquePaiement', async (req, res) => {
  try {
    const { reparationId, clientId, montant, datePaiement, methode, statut, notes, numReference } = req.body;

    if (!reparationId || !clientId || !montant || !datePaiement) {
      return res.status(400).json({
        error: 'reparationId, clientId, montant et datePaiement sont requis'
      });
    }

    if (useFirebase) {
      const docRef = await db.collection('historiquePaiement').add({
        reparationId,
        clientId,
        montant,
        datePaiement: new Date(datePaiement),
        methode: methode || 'especes',
        statut: statut || 'validé',
        notes: notes || '',
        numReference: numReference || '',
        createdAt: new Date()
      });
      const doc = await docRef.get();
      return res.json({ _id: doc.id, ...doc.data() });
    } else {
      return res.status(400).json({ error: 'Firebase non disponible' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT mettre à jour un paiement
app.put('/api/historiquePaiement/:id', async (req, res) => {
  try {
    const { montant, datePaiement, methode, statut, notes, numReference } = req.body;

    const updateData = {};
    if (montant !== undefined) updateData.montant = montant;
    if (datePaiement !== undefined) updateData.datePaiement = new Date(datePaiement);
    if (methode !== undefined) updateData.methode = methode;
    if (statut !== undefined) updateData.statut = statut;
    if (notes !== undefined) updateData.notes = notes;
    if (numReference !== undefined) updateData.numReference = numReference;
    updateData.updatedAt = new Date();

    if (useFirebase) {
      await db.collection('historiquePaiement').doc(req.params.id).update(updateData);
      const doc = await db.collection('historiquePaiement').doc(req.params.id).get();
      return res.json({ _id: doc.id, ...doc.data() });
    } else {
      return res.status(400).json({ error: 'Firebase non disponible' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE un paiement
app.delete('/api/historiquePaiement/:id', async (req, res) => {
  try {
    if (useFirebase) {
      await db.collection('historiquePaiement').doc(req.params.id).delete();
      return res.json({ message: 'Paiement supprimé avec succès' });
    } else {
      return res.status(400).json({ error: 'Firebase non disponible' });
    }
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

// GET une pièce par ID
app.get('/api/pieces/:id', async (req, res) => {
  try {
    let piece;

    if (useFirebase) {
      const doc = await db.collection('piecesReparables').doc(req.params.id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Pièce non trouvée' });
      }
      piece = { _id: doc.id, ...doc.data() };
    } else {
      piece = (seedData.piecesReparables || []).find(p => p._id === req.params.id);
      if (!piece) {
        return res.status(404).json({ error: 'Pièce non trouvée' });
      }
    }

    res.json(piece);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET tous les types de pièces
app.get('/api/typesPieces', async (req, res) => {
  try {
    let types;

    if (useFirebase) {
      const snapshot = await db.collection('typesPieces').get();
      types = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    } else {
      types = seedData.typesPieces || [];
    }

    res.json(types);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET un type de pièce par ID
app.get('/api/typesPieces/:id', async (req, res) => {
  try {
    let type;

    if (useFirebase) {
      const doc = await db.collection('typesPieces').doc(req.params.id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Type de pièce non trouvé' });
      }
      type = { _id: doc.id, ...doc.data() };
    } else {
      type = (seedData.typesPieces || []).find(t => t._id === req.params.id);
      if (!type) {
        return res.status(404).json({ error: 'Type de pièce non trouvé' });
      }
    }

    res.json(type);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST créer une nouvelle pièce
// body: { nomPieces, prix, typeId }
app.post('/api/pieces', async (req, res) => {
  try {
    const { nomPieces, prix, typeId } = req.body;

    if (!nomPieces || !prix || !typeId) {
      return res.status(400).json({
        error: 'nomPieces, prix et typeId sont requis'
      });
    }

    if (useFirebase) {
      // Récupérer les données du type
      const typeDoc = await db.collection('typesPieces').doc(typeId).get();
      if (!typeDoc.exists) {
        return res.status(404).json({ error: 'Type de pièce non trouvé' });
      }

      const now = new Date();
      const piece = {
        nomPieces,
        prix: parseFloat(prix),
        type: {
          _id: typeId,
          nomTypePieces: typeDoc.data().nomTypePieces
        },
        createdAt: now,
        updatedAt: now
      };

      // Générer un ID séquentiel PR-XXX
      const piecesSnapshot = await db.collection('piecesReparables').get();
      const count = piecesSnapshot.size + 1;
      const newId = `PR-${String(count).padStart(3, '0')}`;

      await db.collection('piecesReparables').doc(newId).set(piece);
      const doc = await db.collection('piecesReparables').doc(newId).get();
      return res.json({ _id: doc.id, ...doc.data() });
    } else {
      // Mode JSON local
      const pieces = seedData.piecesReparables || [];
      const type = (seedData.typesPieces || []).find(t => t._id === typeId);
      
      if (!type) {
        return res.status(404).json({ error: 'Type de pièce non trouvé' });
      }

      const newId = `PR-${String(pieces.length + 1).padStart(3, '0')}`;
      const newPiece = {
        _id: newId,
        nomPieces,
        prix: parseFloat(prix),
        type: {
          _id: typeId,
          nomTypePieces: type.nomTypePieces
        }
      };

      pieces.push(newPiece);
      seedData.piecesReparables = pieces;
      
      try {
        fs.writeFileSync(seedDataPath, JSON.stringify(seedData, null, 2), 'utf8');
      } catch (err) {
        console.error('Erreur écriture seedData.json:', err);
      }

      return res.json(newPiece);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT modifier une pièce
// body: { nomPieces, prix, typeId }
app.put('/api/pieces/:id', async (req, res) => {
  try {
    const { nomPieces, prix, typeId } = req.body;

    if (!nomPieces && !prix && !typeId) {
      return res.status(400).json({
        error: 'Au moins un champ (nomPieces, prix ou typeId) est requis'
      });
    }

    if (useFirebase) {
      const piecesRef = db.collection('piecesReparables').doc(req.params.id);
      const pieceDoc = await piecesRef.get();
      
      if (!pieceDoc.exists) {
        return res.status(404).json({ error: 'Pièce non trouvée' });
      }

      const updateData = {
        updatedAt: new Date()
      };

      if (nomPieces) updateData.nomPieces = nomPieces;
      if (prix) updateData.prix = parseFloat(prix);
      
      if (typeId) {
        const typeDoc = await db.collection('typesPieces').doc(typeId).get();
        if (!typeDoc.exists) {
          return res.status(404).json({ error: 'Type de pièce non trouvé' });
        }
        updateData.type = {
          _id: typeId,
          nomTypePieces: typeDoc.data().nomTypePieces
        };
      }

      await piecesRef.update(updateData);
      const doc = await piecesRef.get();
      return res.json({ _id: doc.id, ...doc.data() });
    } else {
      // Mode JSON local
      const pieces = seedData.piecesReparables || [];
      const piece = pieces.find(p => p._id === req.params.id);
      
      if (!piece) {
        return res.status(404).json({ error: 'Pièce non trouvée' });
      }

      if (nomPieces) piece.nomPieces = nomPieces;
      if (prix) piece.prix = parseFloat(prix);
      
      if (typeId) {
        const type = (seedData.typesPieces || []).find(t => t._id === typeId);
        if (!type) {
          return res.status(404).json({ error: 'Type de pièce non trouvé' });
        }
        piece.type = {
          _id: typeId,
          nomTypePieces: type.nomTypePieces
        };
      }

      try {
        fs.writeFileSync(seedDataPath, JSON.stringify(seedData, null, 2), 'utf8');
      } catch (err) {
        console.error('Erreur écriture seedData.json:', err);
      }

      return res.json(piece);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE supprimer une pièce
app.delete('/api/pieces/:id', async (req, res) => {
  try {
    if (useFirebase) {
      await db.collection('piecesReparables').doc(req.params.id).delete();
      return res.json({ message: 'Pièce supprimée avec succès' });
    } else {
      // Mode JSON local
      const pieces = seedData.piecesReparables || [];
      const index = pieces.findIndex(p => p._id === req.params.id);
      
      if (index === -1) {
        return res.status(404).json({ error: 'Pièce non trouvée' });
      }

      pieces.splice(index, 1);
      seedData.piecesReparables = pieces;

      try {
        fs.writeFileSync(seedDataPath, JSON.stringify(seedData, null, 2), 'utf8');
      } catch (err) {
        console.error('Erreur écriture seedData.json:', err);
      }

      return res.json({ message: 'Pièce supprimée avec succès' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST créer un nouveau type de pièce
// body: { nomTypePieces }
app.post('/api/typesPieces', async (req, res) => {
  try {
    const { nomTypePieces } = req.body;

    if (!nomTypePieces) {
      return res.status(400).json({ error: 'nomTypePieces est requis' });
    }

    if (useFirebase) {
      const now = new Date();
      const type = {
        nomTypePieces,
        createdAt: now,
        updatedAt: now
      };

      const docRef = await db.collection('typesPieces').add(type);
      const doc = await docRef.get();
      return res.json({ _id: doc.id, ...doc.data() });
    } else {
      // Mode JSON local
      const types = seedData.typesPieces || [];
      const newId = `TP-${String(types.length + 1).padStart(3, '0')}`;
      const newType = {
        _id: newId,
        nomTypePieces
      };

      types.push(newType);
      seedData.typesPieces = types;

      try {
        fs.writeFileSync(seedDataPath, JSON.stringify(seedData, null, 2), 'utf8');
      } catch (err) {
        console.error('Erreur écriture seedData.json:', err);
      }

      return res.json(newType);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============== ENDPOINTS SLOTS RÉPARATION ==============

// GET tous les slots de réparation
app.get('/api/slotReparation', async (req, res) => {
  try {
    let slots;

    if (useFirebase) {
      const snapshot = await db.collection('slotReparation').get();
      slots = snapshot.docs
        .filter(doc => doc.id !== '_metadata')
        .map(doc => ({ id: doc.id, ...doc.data() }));
    } else {
      slots = [];
    }

    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET un slot de réparation par ID
app.get('/api/slotReparation/:id', async (req, res) => {
  try {
    if (useFirebase) {
      const doc = await db.collection('slotReparation').doc(req.params.id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Slot non trouvé' });
      }
      res.json({ id: doc.id, ...doc.data() });
    } else {
      res.status(400).json({ error: 'Firebase non disponible' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST créer un slot de réparation
app.post('/api/slotReparation', async (req, res) => {
  try {
    const { idReparation, startTime } = req.body;
    
    if (!idReparation || !startTime) {
      return res.status(400).json({ error: 'idReparation et startTime sont requis' });
    }
    
    if (useFirebase) {
      const docRef = await db.collection('slotReparation').add({
        idReparation,
        startTime: new Date(startTime),
        createdAt: new Date()
      });
      res.json({ id: docRef.id, message: 'Slot créé avec succès' });
    } else {
      res.status(400).json({ error: 'Firebase non disponible' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// POST ASSIGNER une réparation à un slot (1, 2 ou 3)
app.post('/api/slotReparation/assign', async (req, res) => {
  try {
    const { idReparation } = req.body;

    if (!idReparation) {
      return res.status(400).json({ error: 'idReparation est requis' });
    }

    if (!useFirebase || !db) {
      return res.status(400).json({ error: 'Firebase non disponible' });
    }

    const slotsCol = db.collection('slotReparation');
    const now = new Date();

    // Liste des slots gérés : 1, 2, 3
    const slotIds = ['1', '2', '3'];

    let chosenSlotRef = null;
    let chosenSlotNumber = null;

    // Cherche le premier slot libre
    for (const slotId of slotIds) {
      const slotRef = slotsCol.doc(slotId);
      const snap = await slotRef.get();

      if (!snap.exists) {
        // Document inexistant → slot libre
        chosenSlotRef = slotRef;
        chosenSlotNumber = slotId;
        break;
      }

      const data = snap.data() || {};
      const currentRep = data.idReparation || '';

      if (!currentRep) {
        // Doc existe mais idReparation vide → slot libre
        chosenSlotRef = slotRef;
        chosenSlotNumber = slotId;
        break;
      }
    }

    // Aucun slot libre
    if (!chosenSlotRef) {
      return res.status(400).json({ error: 'Les trois slots sont déjà occupés' });
    }

    await chosenSlotRef.set(
      {
        idReparation: idReparation,
        startTime: now,
        createdAt: now
      },
      { merge: true }
    );

    return res.json({
      message: 'Slot assigné avec succès',
      slotNumber: Number(chosenSlotNumber),
      slotId: String(chosenSlotNumber),
      idReparation: idReparation
    });
  } catch (err) {
    console.error('Erreur assignation slotReparation:', err);
    return res.status(500).json({ error: err.message });
  }
});


// DELETE un slot de réparation
app.delete('/api/slotReparation/:id', async (req, res) => {
  try {
    if (useFirebase) {
      await db.collection('slotReparation').doc(req.params.id).delete();
      res.json({ message: 'Slot supprimé avec succès' });
    } else {
      res.status(400).json({ error: 'Firebase non disponible' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============== ENDPOINTS SLOTS ATTENTE ==============

// GET tous les slots d'attente
app.get('/api/slotAttente', async (req, res) => {
  try {
    let slots;
    
    if (useFirebase) {
      const snapshot = await db.collection('slotAttente').get();
      slots = snapshot.docs
        .filter(doc => doc.id !== '_metadata')
        .map(doc => ({ id: doc.id, ...doc.data() }));
    } else {
      slots = [];
    }
    
    res.json(slots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET un slot d'attente par ID
app.get('/api/slotAttente/:id', async (req, res) => {
  try {
    if (useFirebase) {
      const doc = await db.collection('slotAttente').doc(req.params.id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Slot non trouvé' });
      }
      res.json({ id: doc.id, ...doc.data() });
    } else {
      res.status(400).json({ error: 'Firebase non disponible' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST créer un slot d'attente
app.post('/api/slotAttente', async (req, res) => {
  try {
    const { idReparation, startTime } = req.body;
    
    if (!idReparation || !startTime) {
      return res.status(400).json({ error: 'idReparation et startTime sont requis' });
    }
    
    if (!useFirebase || !db) {
      return res.status(400).json({ error: 'Firebase non disponible' });
    }

    const coll = db.collection('slotAttente');
    const now = new Date();

    const baseData = {
      idReparation,
      startTime: new Date(startTime),
      createdAt: now
    };

    // SLOT 1
    const slot1Ref = coll.doc('1');
    const slot1Snap = await slot1Ref.get();

    if (!slot1Snap.exists) {
      await slot1Ref.set({ ...baseData, slotId: 1 });
      return res.json({
        id: '1',
        slotId: 1,
        message: 'Slot d\'attente créé sur la position 1'
      });
    }

    // SLOT 2
    const slot2Ref = coll.doc('2');
    const slot2Snap = await slot2Ref.get();

    if (!slot2Snap.exists) {
      await slot2Ref.set({ ...baseData, slotId: 2 });
      return res.json({
        id: '2',
        slotId: 2,
        message: 'Slot d\'attente créé sur la position 2'
      });
    }

    // AUCUN SLOT LIBRE
    return res.status(409).json({
      error: 'Aucun slot d\'attente disponible (1 et 2 déjà occupés)'
    });
  } catch (err) {
    console.error('Erreur /api/slotAttente :', err);
    res.status(500).json({ error: err.message });
  }
});

// RESET COMPLET de la collection slotAttente
app.get('/api/slotAttente/reset', async (req, res) => {
  try {
    if (!useFirebase) {
      return res.status(400).json({ error: 'Firebase non disponible' });
    }

    const colRef = db.collection('slotAttente');
    const docs = await colRef.listDocuments();

    if (docs.length === 0) {
      return res.json({ success: true, deleted: 0, message: 'Aucun document slotAttente à supprimer' });
    }

    const batch = db.batch();
    docs.forEach(doc => batch.delete(doc));
    await batch.commit();

    res.json({
      success: true,
      deleted: docs.length,
      message: 'slotAttente vidé.'
    });
  } catch (err) {
    console.error('Erreur reset slotAttente:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE un slot d'attente
app.delete('/api/slotAttente/:id', async (req, res) => {
  try {
    if (useFirebase) {
      await db.collection('slotAttente').doc(req.params.id).delete();
      res.json({ message: 'Slot supprimé avec succès' });
    } else {
      res.status(400).json({ error: 'Firebase non disponible' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============== ENDPOINTS NOTIFICATIONS ==============

// Fonction pour mettre toutes les réparations en cours
async function setAllReparationsEnCours(req, res) {
  try {
    let modified = 0;

    if (useFirebase && db) {
      // MODE FIREBASE : tous les docs "reparations" → EN_COURS
      const snap = await db.collection('reparations').get();

      if (!snap.empty) {
        const batch = db.batch();
        snap.docs.forEach(doc => {
          batch.update(doc.ref, { statut: 'EN_COURS' });
        });
        await batch.commit();
        modified = snap.size;
      }

      return res.json({
        message: 'Statut mis à EN_COURS pour toutes les réparations',
        mode: 'firebase',
        modified
      });
    } else {
      // MODE JSON LOCAL
      const reps = seedData.reparations || [];
      reps.forEach(r => {
        r.statut = 'EN_COURS';
      });

      try {
        fs.writeFileSync(seedDataPath, JSON.stringify(seedData, null, 2), 'utf8');
      } catch (err) {
        console.error('Erreur écriture seedData.json :', err);
      }

      modified = reps.length;

      return res.json({
        message: 'Statut mis à EN_COURS pour toutes les réparations',
        mode: 'json',
        modified
      });
    }
  } catch (err) {
    console.error('Erreur mise à jour statut EN_COURS :', err);
    res.status(500).json({ error: err.message });
  }
}

// PUT pour les appels "propres"
app.put('/api/reparations/statut/en-cours', setAllReparationsEnCours);

// GET pour que l'URL fonctionne dans le navigateur
app.get('/api/reparations/statut/en-cours', setAllReparationsEnCours);

// ============== ENDPOINTS NOTIFICATIONS ==============

// GET toutes les notifications
app.get('/api/notifications', async (req, res) => {
  try {
    let notifications;

    if (useFirebase) {
      const snapshot = await db.collection('notifications').get();
      notifications = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    } else {
      notifications = seedData.notifications || [];
    }

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET une notification par ID
app.get('/api/notifications/:id', async (req, res) => {
  try {
    let notification;

    if (useFirebase) {
      const doc = await db.collection('notifications').doc(req.params.id).get();
      if (!doc.exists) {
        return res.status(404).json({ error: 'Notification non trouvée' });
      }
      notification = { _id: doc.id, ...doc.data() };
    } else {
      notification = seedData.notifications?.find(n => n._id === req.params.id);
      if (!notification) {
        return res.status(404).json({ error: 'Notification non trouvée' });
      }
    }

    res.json(notification);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET notifications par voiture
app.get('/api/notifications/voiture/:voitureId', async (req, res) => {
  try {
    let notifications;

    if (useFirebase) {
      const snapshot = await db.collection('notifications')
        .where('voitureId', '==', req.params.voitureId)
        .get();
      notifications = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    } else {
      notifications = (seedData.notifications || []).filter(
        n => n.voitureId === req.params.voitureId
      );
    }

    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET notifications non lues
app.get('/api/notifications/unread', async (req, res) => {
  try {
    let notifications;

    if (useFirebase) {
      const snapshot = await db.collection('notifications')
        .where('read', '==', false)
        .get();
      notifications = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    } else {
      notifications = (seedData.notifications || []).filter(n => !n.read);
    }

    res.json(notifications);
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
      pieces: seedData.piecesReparables ? seedData.piecesReparables.length : 0,
      notifications: seedData.notifications ? seedData.notifications.length : 0
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
