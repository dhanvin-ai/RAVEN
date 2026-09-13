"""
Healthcare & Clinical Patient Triage Tools

Provides mock implementations for clinical operations:
- Patient medical record lookups
- Clinical specialty appointments
- Prescription refills (with controlled substances safeguards)
- Emergency triage escalations (ER / 911 dispatch)
"""

from typing import Any, Dict, List

MOCK_PATIENTS = {
    "PAT-101": {
        "patient_id": "PAT-101",
        "name": "Robert Hayes",
        "age": 58,
        "conditions": ["Hypertension", "Type 2 Diabetes"],
        "active_prescriptions": ["Lisinopril 10mg", "Metformin 500mg"],
        "allergies": ["Penicillin"],
        "primary_physician": "Dr. Sarah Chen, MD",
    },
    "PAT-202": {
        "patient_id": "PAT-202",
        "name": "Emily Watson",
        "age": 34,
        "conditions": ["Asthma", "Allergic Rhinitis"],
        "active_prescriptions": ["Albuterol Inhaler", "Cetirizine 10mg"],
        "allergies": ["Sulfa drugs"],
        "primary_physician": "Dr. James Wilson, MD",
    },
}

CONTROLLED_SUBSTANCES = {
    "oxycodone", "hydrocodone", "adderall", "xanax", "morphine", "fentanyl", "codeine", "percocet"
}


def lookup_patient_records(patient_id: str) -> Dict[str, Any]:
    """Retrieve verified medical records and active prescriptions for a patient."""
    clean_id = patient_id.strip().upper()
    patient = MOCK_PATIENTS.get(clean_id)
    if not patient:
        return {
            "success": False,
            "error": f"Patient ID {patient_id} not found in hospital directory."
        }
    return {
        "success": True,
        "patient_id": patient["patient_id"],
        "name": patient["name"],
        "age": patient["age"],
        "conditions": patient["conditions"],
        "active_prescriptions": patient["active_prescriptions"],
        "allergies": patient["allergies"],
        "primary_physician": patient["primary_physician"],
    }


def schedule_appointment(
    patient_id: str,
    specialty: str = "General Medicine",
    preferred_date: str = None,
    date: str = None,
    **kwargs
) -> Dict[str, Any]:
    """Schedule an outpatient consultation with a physician specialist."""
    clean_id = patient_id.strip().upper() if patient_id else "PAT-101"
    patient = MOCK_PATIENTS.get(clean_id, {"name": "Verified Patient"})
    final_date = preferred_date or date or kwargs.get("appointment_date") or "2026-09-15"

    return {
        "success": True,
        "confirmation_number": f"APT-{clean_id[-3:]}-2026",
        "patient_id": clean_id,
        "patient_name": patient["name"],
        "specialty": specialty or kwargs.get("department", "General Medicine"),
        "scheduled_date": final_date,
        "clinic_location": "St. Jude Clinical Pavilion, Suite 400",
        "status": "CONFIRMED",
        "message": f"Appointment booked with {specialty} for {final_date}."
    }


def refill_prescription(
    patient_id: str,
    medication: str = "Lisinopril 10mg",
    quantity: int = 30,
    **kwargs
) -> Dict[str, Any]:
    """Requests a prescription refill for maintenance medications."""
    clean_id = patient_id.strip().upper() if patient_id else "PAT-101"
    patient = MOCK_PATIENTS.get(clean_id)
    if not patient:
        return {
            "success": False,
            "error": f"Patient {patient_id} record not found."
        }

    med_name = medication or kwargs.get("drug") or kwargs.get("rx") or "Lisinopril 10mg"
    med_lower = med_name.lower()
    for drug in CONTROLLED_SUBSTANCES:
        if drug in med_lower:
            return {
                "success": False,
                "error": f"CONTROLLED_SUBSTANCE_BLOCKED: {med_name} is a Schedule II controlled substance. Refills cannot be approved by an automated agent. In-person physician evaluation is legally mandated under DEA regulations."
            }

    # Verify if active prescription
    has_prescription = any(med_lower in active.lower() for active in patient["active_prescriptions"])
    if not has_prescription:
        return {
            "success": False,
            "error": f"UNVERIFIED_MEDICATION: {med_name} is not currently in patient's active prescription chart. Primary physician approval required."
        }

    return {
        "success": True,
        "order_id": f"RX-REFILL-{clean_id[-3:]}-88",
        "patient_id": clean_id,
        "medication": med_name,
        "quantity": quantity,
        "status": "SENT_TO_PHARMACY",
        "pharmacy": "Walgreens #4412 (Central Blvd)",
        "message": f"Refill for {med_name} ({quantity} units) transmitted to pharmacy."
    }


def escalate_to_emergency(
    patient_id: str,
    symptoms: str = "Critical symptoms reported",
    **kwargs
) -> Dict[str, Any]:
    """Immediately triggers critical emergency triage alert and EMS dispatch."""
    clean_id = patient_id.strip().upper() if patient_id else "PAT-101"
    patient = MOCK_PATIENTS.get(clean_id, {"name": "Anonymous Patient"})
    symptom_text = symptoms or kwargs.get("reason") or "Acute symptoms requiring immediate evaluation"

    return {
        "success": True,
        "triage_level": "LEVEL_1_RESUSCITATION",
        "ems_dispatched": True,
        "patient_id": clean_id,
        "patient_name": patient.get("name"),
        "reported_symptoms": symptom_text,
        "action_taken": "Emergency Medical Services (EMS) alerted. Critical cardiac/trauma team notified.",
        "patient_instructions": "PLEASE DIAL 911 IMMEDIATELY OR PROCEED TO THE NEAREST EMERGENCY ROOM. DO NOT DRIVE YOURSELF."
    }
