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

// POST ASSIGNER une réparation à un slot FIXE
app.post('/api/slotReparation/assign', async (req, res) => {
  try {
    const { idReparation } = req.body;

    if (!idReparation) {
      return res.status(400).json({ error: 'idReparation est requis' });
    }

    if (!useFirebase) {
      return res.status(400).json({ error: 'Firebase non disponible' });
    }

    const slotsCol = db.collection('slotReparation');
    const slot1Ref = slotsCol.doc('1');
    const slot2Ref = slotsCol.doc('2');

    const [slot1Snap, slot2Snap] = await Promise.all([
      slot1Ref.get(),
      slot2Ref.get()
    ]);

    const now = new Date();

    const isEmpty = (snap) => {
      if (!snap.exists) return true;
      const data = snap.data();
      return !data.idReparation || data.idReparation === '';
    };

    let chosenSlotRef = null;
    let chosenSlotNumber = null;

    if (isEmpty(slot1Snap)) {
      chosenSlotRef = slot1Ref;
      chosenSlotNumber = 1;
    } else if (isEmpty(slot2Snap)) {
      chosenSlotRef = slot2Ref;
      chosenSlotNumber = 2;
    } else {
      return res.status(400).json({ error: 'Les deux slots sont déjà occupés' });
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
      slotNumber: chosenSlotNumber,
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
