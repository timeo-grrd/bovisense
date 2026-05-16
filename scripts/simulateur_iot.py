import sys
import os
import requests
import random
import math
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8')

AZURE_URL = "https://bovisens-gzguhzapdug4arc6.francecentral-01.azurewebsites.net/api/predict"
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")


def generer_donnees_vache(id_vache, etat_force=None):
    """Génère des données IoT réalistes selon un état aléatoire"""
    heure = datetime.now().hour
    est_nuit = heure >= 22 or heure < 6

    # Choisir un état aléatoire pondéré si pas forcé
    if not etat_force:
        etats = ['Normale', 'Normale', 'Normale', 'Normale', 'Normale',
                 'Normale', 'Normale', 'Normale', 'En chaleur',
                 'Boiterie légère', 'Boiterie sévère', 'Chute']
        etat = random.choice(etats)
    else:
        etat = etat_force

    base_temp = random.gauss(38.6, 0.2)
    temp_ext = random.gauss(15.0, 5.0)
    if est_nuit:
        temp_ext -= 4.0

    if etat == 'Normale':
        pas = max(0, int(random.gauss(100 if est_nuit else 600, 50 if est_nuit else 150)))
        repos = max(0, min(120, random.gauss(90 if est_nuit else 40, 15)))
        temp = random.gauss(base_temp, 0.2)
    elif etat == 'En chaleur':
        pas = max(0, int(random.gauss(300 if est_nuit else 1200, 100 if est_nuit else 300)))
        repos = max(0, min(120, random.gauss(50 if est_nuit else 15, 20 if est_nuit else 10)))
        temp = random.gauss(base_temp + 0.6, 0.2)
    elif etat == 'Boiterie légère':
        pas = max(0, int(random.gauss(50 if est_nuit else 300, 20 if est_nuit else 100)))
        repos = max(0, min(120, random.gauss(100 if est_nuit else 70, 10 if est_nuit else 20)))
        temp = random.gauss(base_temp + 0.3, 0.2)
    elif etat == 'Boiterie sévère':
        pas = max(0, int(random.gauss(10 if est_nuit else 80, 5 if est_nuit else 30)))
        repos = max(0, min(120, random.gauss(115 if est_nuit else 100, 5 if est_nuit else 15)))
        temp = random.gauss(base_temp + 0.8, 0.3)
    elif etat == 'Chute':
        pas = max(0, int(random.gauss(0, 5)))
        repos = 120.0
        temp = random.gauss(base_temp - 1.0, 0.5)
    else:
        pas = max(0, int(random.gauss(600, 150)))
        repos = max(0, min(120, random.gauss(40, 15)))
        temp = random.gauss(base_temp, 0.2)

    return {
        "ID_Vache": id_vache,
        "Heure": heure,
        "Pas_2h": pas,
        "Repos_min_2h": round(repos, 1),
        "Temp_Corp_C": round(temp, 1),
        "Temp_Ext_C": round(temp_ext, 1),
        "Lat": 48.0690 + random.uniform(-0.01, 0.01),
        "Lng": -1.6325 + random.uniform(-0.01, 0.01)
    }


def analyser_vache(donnees):
    """Envoie les données à l'IA Azure et retourne le diagnostic"""
    try:
        response = requests.post(AZURE_URL, json=donnees, timeout=10)
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        print(f"Erreur Azure : {e}")
        return None


def mettre_a_jour_supabase(id_vache, etat, fiabilite, donnees):
    """Met à jour la vache dans Supabase"""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }

    # Update colliers
    payload_collier = {
        "etat_sante": etat,
        "fiabilite_ia": fiabilite,
        "pas_2h": donnees["Pas_2h"],
        "repos_min_2h": donnees["Repos_min_2h"],
        "temp_corp_c": donnees["Temp_Corp_C"],
        "temp_ext_c": donnees["Temp_Ext_C"],
        "derniere_maj": datetime.now().isoformat()
    }

    requests.patch(
        f"{SUPABASE_URL}/rest/v1/colliers?id_vache=eq.{id_vache}",
        json=payload_collier,
        headers=headers
    )

    # Récupère l'id du collier et le user_id pour l'historique
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/colliers?id_vache=eq.{id_vache}&select=id,user_id",
        headers=headers
    )
    if r.status_code == 200 and r.json():
        collier = r.json()[0]
        payload_historique = {
            "collier_id": collier["id"],
            "user_id": collier["user_id"],
            "id_vache": id_vache,
            "etat_sante": etat,
            "fiabilite_ia": fiabilite,
            "pas_2h": donnees["Pas_2h"],
            "repos_min_2h": int(donnees["Repos_min_2h"]),
            "temp_corp_c": donnees["Temp_Corp_C"],
            "temp_ext_c": donnees["Temp_Ext_C"]
        }
        requests.post(
            f"{SUPABASE_URL}/rest/v1/historique_sante",
            json=payload_historique,
            headers=headers
        )


def simuler_toutes_vaches():
    """Récupère toutes les vaches et simule leurs données"""
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }

    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/colliers?select=id_vache,etat_sante&en_paturage=eq.true",
        headers=headers
    )

    if r.status_code != 200:
        print("Erreur récupération vaches")
        return

    vaches = r.json()
    print(f"🐄 {len(vaches)} vaches à analyser...")

    for vache in vaches:
        id_vache = vache["id_vache"]
        donnees = generer_donnees_vache(id_vache)

        resultat = analyser_vache(donnees)

        if resultat:
            etat = resultat.get("etat_sante", "Normale")
            fiabilite = (
                resultat.get("probabilite") or
                resultat.get("fiabilite") or
                resultat.get("confidence") or
                None
            )
            mettre_a_jour_supabase(id_vache, etat, fiabilite, donnees)
            print(f"✅ {id_vache} → {etat} ({fiabilite}%)")
        else:
            print(f"❌ {id_vache} → Erreur IA")


if __name__ == "__main__":
    simuler_toutes_vaches()
