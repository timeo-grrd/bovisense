import os
import requests
import random
import numpy as np
from datetime import datetime, timedelta
import time

AZURE_URL = "https://bovisens-gzguhzapdug4arc6.francecentral-01.azurewebsites.net/api/predict"
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://wsvqomiycexnfrclqwgq.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

headers_supabase = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

# États et transitions (Chaîne de Markov)
ETATS = {
    0: 'Normale',
    1: 'En chaleur',
    2: 'Boiterie légère',
    3: 'Boiterie sévère',
    4: 'Chute'
}

TRANSITIONS = {
    0: {0: 0.94, 1: 0.03, 2: 0.02, 3: 0.00, 4: 0.01},
    1: {0: 0.80, 1: 0.20, 2: 0.00, 3: 0.00, 4: 0.00},
    2: {0: 0.20, 1: 0.00, 2: 0.60, 3: 0.20, 4: 0.00},
    3: {0: 0.00, 1: 0.00, 2: 0.20, 3: 0.80, 4: 0.00},
    4: {0: 0.00, 1: 0.00, 2: 0.00, 3: 0.00, 4: 1.00},
}

def obtenir_temp_ext():
    try:
        r = requests.get(
            "https://api.open-meteo.com/v1/forecast?latitude=48.0712&longitude=-1.6325"
            "&current=temperature_2m&timezone=Europe/Paris",
            timeout=5
        )
        if r.status_code == 200:
            return round(r.json()["current"]["temperature_2m"], 1)
    except Exception as e:
        print(f"Avertissement météo : {e}")
    return 15.0

def generer_donnees_vache(vache_id, etat_idx, heure, base_temp, temp_ext):
    est_nuit = heure >= 22 or heure < 6

    if etat_idx == 0:  # Normale
        pas = max(0, int(np.random.normal(100 if est_nuit else 600, 50 if est_nuit else 150)))
        repos = max(0, min(120, round(np.random.normal(90 if est_nuit else 40, 15), 1)))
        temp = round(np.random.normal(base_temp, 0.2), 1)
    elif etat_idx == 1:  # Chaleur
        pas = max(0, int(np.random.normal(300 if est_nuit else 1200, 100 if est_nuit else 300)))
        repos = max(0, min(120, round(np.random.normal(50 if est_nuit else 15, 20 if est_nuit else 10), 1)))
        temp = round(np.random.normal(base_temp + 0.6, 0.2), 1)
    elif etat_idx == 2:  # Boiterie légère
        pas = max(0, int(np.random.normal(50 if est_nuit else 300, 20 if est_nuit else 100)))
        repos = max(0, min(120, round(np.random.normal(100 if est_nuit else 70, 10 if est_nuit else 20), 1)))
        temp = round(np.random.normal(base_temp + 0.3, 0.2), 1)
    elif etat_idx == 3:  # Boiterie sévère
        pas = max(0, int(np.random.normal(10 if est_nuit else 80, 5 if est_nuit else 30)))
        repos = max(0, min(120, round(np.random.normal(115 if est_nuit else 100, 5 if est_nuit else 15), 1)))
        temp = round(np.random.normal(base_temp + 0.8, 0.3), 1)
    elif etat_idx == 4:  # Chute
        pas = 0
        repos = 120.0
        temp = round(np.random.normal(base_temp - 1.0, 0.5), 1)
    else:
        pas = 0
        repos = 0.0
        temp = base_temp

    return {
        "ID_Vache": vache_id,
        "Heure": heure,
        "Pas_2h": pas,
        "Repos_min_2h": repos,
        "Temp_Corp_C": temp,
        "Temp_Ext_C": round(temp_ext, 1),
        "Lat": 48.0690 + random.uniform(-0.01, 0.01),
        "Lng": -1.6325 + random.uniform(-0.01, 0.01)
    }

def appeler_azure(payload):
    try:
        r = requests.post(AZURE_URL, json=payload, timeout=10)
        if r.status_code == 200:
            return r.json().get('etat_sante', 'Normale')
    except Exception:
        pass
    return payload.get('etat_attendu', 'Normale')

def recuperer_vaches():
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/colliers?select=id,id_vache,user_id,latitude,longitude",
        headers=headers_supabase
    )
    if r.status_code == 200:
        return r.json()
    return []

def inserer_historique_batch(lignes):
    if not lignes:
        return 0
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/historique_sante",
        json=lignes,
        headers={**headers_supabase, "Prefer": "resolution=ignore-duplicates"}
    )
    return r.status_code

def mettre_a_jour_collier(vache_id_db, etat, donnees):
    requests.patch(
        f"{SUPABASE_URL}/rest/v1/colliers?id=eq.{vache_id_db}",
        json={
            "etat_sante": etat,
            "pas_2h": donnees["Pas_2h"],
            "repos_min_2h": donnees["Repos_min_2h"],
            "temp_corp_c": donnees["Temp_Corp_C"],
            "temp_ext_c": donnees["Temp_Ext_C"],
            "derniere_maj": datetime.now().isoformat()
        },
        headers=headers_supabase
    )

def generer_historique_complet():
    print("📡 Récupération des vaches depuis Supabase...")
    vaches = recuperer_vaches()

    if not vaches:
        print("❌ Aucune vache trouvée")
        return

    print(f"🐄 {len(vaches)} vaches trouvées")

    # Temp ext réelle depuis Open-Meteo (une seule fois)
    try:
        r = requests.get(
            "https://api.open-meteo.com/v1/forecast?latitude=48.0712&longitude=-1.6325&current=temperature_2m&timezone=Europe/Paris",
            timeout=5
        )
        temp_ext_actuelle = r.json()['current']['temperature_2m']
    except Exception:
        temp_ext_actuelle = 15.0

    print(f"🌡️ Température extérieure actuelle : {temp_ext_actuelle}°C")

    NB_JOURS = 7
    TRANCHES_PAR_JOUR = 12  # toutes les 2h

    for idx, vache in enumerate(vaches):
        vache_id = vache['id_vache']
        vache_db_id = vache['id']
        user_id = vache['user_id']
        base_temp = round(np.random.normal(38.6, 0.2), 1)

        print(f"[{idx+1}/{len(vaches)}] Génération historique {vache_id}...")

        # État initial aléatoire pondéré (majorité saines)
        etat_idx = int(np.random.choice(
            [0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4],
        ))

        lignes_batch = []
        etat_final = 'Normale'
        donnees_finales = None

        for jour in range(NB_JOURS, 0, -1):
            date_jour = datetime.now() - timedelta(days=jour)
            temp_ext_jour = temp_ext_actuelle + random.uniform(-3, 3)

            # Transition d'état (une fois par jour)
            etat_idx = int(np.random.choice(
                list(TRANSITIONS[etat_idx].keys()),
                p=list(TRANSITIONS[etat_idx].values())
            ))
            etat_attendu = ETATS[etat_idx]

            for tranche in range(TRANCHES_PAR_JOUR):
                heure = tranche * 2
                est_nuit = heure >= 22 or heure < 6
                temp_ext = temp_ext_jour - 4 if est_nuit else temp_ext_jour

                date_diagnostic = date_jour.replace(
                    hour=heure, minute=0, second=0, microsecond=0
                )

                donnees = generer_donnees_vache(
                    vache_id, etat_idx, heure, base_temp, temp_ext
                )

                if jour == 1:
                    etat_ia = appeler_azure(donnees)
                    etat_final = etat_ia
                    donnees_finales = donnees
                else:
                    etat_ia = etat_attendu

                lignes_batch.append({
                    "collier_id": vache_db_id,
                    "user_id": user_id,
                    "id_vache": vache_id,
                    "etat_sante": etat_ia,
                    "pas_2h": donnees["Pas_2h"],
                    "repos_min_2h": int(donnees["Repos_min_2h"]),
                    "temp_corp_c": donnees["Temp_Corp_C"],
                    "temp_ext_c": round(temp_ext, 1),
                    "confirme": False,
                    "date_diagnostic": date_diagnostic.isoformat()
                })

        status = inserer_historique_batch(lignes_batch)
        print(f"  ✅ {len(lignes_batch)} entrées insérées (status: {status})")

        if donnees_finales:
            mettre_a_jour_collier(vache_db_id, etat_final, donnees_finales)

        time.sleep(0.1)

    print(f"\n✅ Historique généré pour {len(vaches)} vaches sur {NB_JOURS} jours !")
    print("📊 Chaque vache a maintenant un historique réaliste avec l'IA Azure")

def simuler_tranche_actuelle():
    vaches = recuperer_vaches()
    if not vaches:
        print("❌ Aucune vache trouvée")
        return

    temp_ext = obtenir_temp_ext()
    print(f"🌡️ Temp ext : {temp_ext}°C — {len(vaches)} vaches")

    for vache in vaches:
        etat_idx = random.choices([0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4])[0]
        donnees = generer_donnees_vache(
            vache['id_vache'],
            etat_idx,
            datetime.now().hour,
            round(random.gauss(38.6, 0.2), 1),
            temp_ext
        )
        etat_ia = appeler_azure(donnees)
        etat = etat_ia if etat_ia else ETATS[etat_idx]

        mettre_a_jour_collier(vache['id'], etat, donnees)
        inserer_historique_batch([{
            "collier_id":   vache['id'],
            "user_id":      vache['user_id'],
            "id_vache":     vache['id_vache'],
            "etat_sante":   etat,
            "pas_2h":       donnees["Pas_2h"],
            "repos_min_2h": int(donnees["Repos_min_2h"]),
            "temp_corp_c":  donnees["Temp_Corp_C"],
            "temp_ext_c":   round(temp_ext, 1),
            "confirme":     False,
            "date_diagnostic": datetime.now().isoformat()
        }])
        print(f"  ✅ {vache['id_vache']} → {etat}")

    print(f"✅ Tranche {datetime.now().strftime('%H:%M')} terminée")


if __name__ == "__main__":
    print("🚀 Démarrage BoviSense Simulator")
    print("📅 Génération de l'historique 7 jours...")
    generer_historique_complet()

    print("\n⏰ Mode automatique — simulation toutes les 2h")
    print("Ctrl+C pour arrêter\n")

    while True:
        time.sleep(2 * 60 * 60)
        print(f"\n⏰ {datetime.now().strftime('%d/%m/%Y %H:%M')} — Nouvelle tranche")
        try:
            simuler_tranche_actuelle()
        except Exception as e:
            print(f"❌ Erreur : {e}")
