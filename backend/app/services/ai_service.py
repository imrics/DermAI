import os
import base64
import json
import re
from typing import Dict, Any, List, Tuple
from openai import AsyncOpenAI
from app.models import HairlineEntry, MoleEntry, AcneEntry, Medication, MedicationCategory, Entry
from datetime import datetime

def encode_image(image_path: str) -> str:
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def extract_json_from_response(response_text: str) -> Dict[str, Any]:
    """Extract JSON from AI response, handling cases where response contains extra text"""
    print(f"DEBUG: Raw AI response: {response_text}")
    
    try:
        # First try to parse as direct JSON
        result = json.loads(response_text)
        print(f"DEBUG: Successfully parsed JSON: {result}")
        return result
    except json.JSONDecodeError as e:
        print(f"DEBUG: JSON decode error: {e}")
        # Try to find JSON within the response text
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if json_match:
            try:
                result = json.loads(json_match.group())
                print(f"DEBUG: Successfully extracted JSON from text: {result}")
                return result
            except json.JSONDecodeError as e2:
                print(f"DEBUG: Failed to parse extracted JSON: {e2}")
        
        # If no valid JSON found, return a default structure
        print(f"DEBUG: Falling back to default structure. Original response: {response_text}")
        return {
            "Comments": response_text[:500] + "..." if len(response_text) > 500 else response_text,
            "Recommendations": "Please consult with a professional for proper evaluation."
        }

async def get_current_medications(user_id: str, category: MedicationCategory) -> str:
    medications = await Medication.find(
        Medication.user_id == user_id,
        Medication.category == category
    ).to_list()
    
    if not medications:
        return "No current medications"
    
    med_list = []
    for med in medications:
        med_str = f"{med.name}"
        if med.dosage:
            med_str += f" ({med.dosage})"
        if med.frequency:
            med_str += f" - {med.frequency}"
        med_list.append(med_str)
    
    return "Current medications: " + ", ".join(med_list)

async def get_medications_as_of(user_id: str, category: MedicationCategory, as_of: datetime) -> str:
    medications = await Medication.find(
        Medication.user_id == user_id,
        Medication.category == category,
        Medication.created_at <= as_of
    ).sort(Medication.created_at).to_list()

    if not medications:
        return "No medications at that time"

    med_list: List[str] = []
    for med in medications:
        med_str = f"{med.name}"
        if med.dosage:
            med_str += f" ({med.dosage})"
        if med.frequency:
            med_str += f" - {med.frequency}"
        med_list.append(med_str)

    return "Medications at that time: " + ", ".join(med_list)

async def fetch_prior_entries_of_same_type(entry: Entry, limit: int = 7) -> List[Entry]:
    if isinstance(entry, HairlineEntry):
        cls = HairlineEntry
    elif isinstance(entry, AcneEntry):
        cls = AcneEntry
    else:
        cls = MoleEntry

    query_conditions = [
        cls.user_id == entry.user_id,
        cls.created_at < entry.created_at
    ]

    # If a sequence is provided, only compare within that sequence
    if entry.sequence_id:
        query_conditions.append(cls.sequence_id == entry.sequence_id)

    prior = await cls.find(*query_conditions).sort(Entry.created_at).to_list()
    if len(prior) > limit:
        prior = prior[-limit:]
    return prior

def summarize_entry_for_prompt(e: Entry) -> str:
    parts: List[str] = [
        f"Date: {e.created_at.isoformat()}"
    ]
    if isinstance(e, HairlineEntry) and e.norwood_score is not None:
        parts.append(f"Norwood: {e.norwood_score}")
    if isinstance(e, AcneEntry) and e.severity_level:
        parts.append(f"Severity: {e.severity_level}")
    if isinstance(e, MoleEntry) and e.irregularities_detected is not None:
        parts.append(f"Irregularities: {'Yes' if e.irregularities_detected else 'No'}")
    if e.user_notes:
        parts.append(f"User notes: {e.user_notes}")
    if e.user_concerns:
        parts.append(f"User concerns: {e.user_concerns}")
    if e.ai_comments:
        parts.append(f"Prev AI comments: {e.ai_comments}")
    if e.recommendations:
        parts.append(f"Prev AI recommendations: {e.recommendations}")
    if e.treatment:
        parts.append(f"Prev AI treatment: {e.treatment}")
    return " | ".join(parts)

async def build_timeline_payload(entry: Entry, analysis_type: str) -> Tuple[str, List[Dict[str, str]]]:
    # Collect prior entries and build image payloads with labels
    prior_entries = await fetch_prior_entries_of_same_type(entry)

    # Determine category for medication lookup
    if analysis_type == "hair":
        med_category = MedicationCategory.HAIRLINE
    elif analysis_type == "skin_texture":
        med_category = MedicationCategory.ACNE
    else:
        med_category = MedicationCategory.MOLE

    legend_lines: List[str] = []
    image_payloads: List[Dict[str, str]] = []

    # Current image first as index 0
    current_meta_lines: List[str] = [
        f"Image [0] — CURRENT | {summarize_entry_for_prompt(entry)}"
    ]
    current_meds = await get_medications_as_of(entry.user_id, med_category, entry.created_at)
    current_meta_lines.append(current_meds)
    legend_lines.extend(current_meta_lines)
    image_payloads.append({
        "label": "Image [0] — CURRENT",
        "base64": encode_image(entry.photo_path)
    })

    # Prior images oldest to newest, index starting at 1
    for idx, prior in enumerate(prior_entries, start=1):
        meds_text = await get_medications_as_of(prior.user_id, med_category, prior.created_at)
        legend_lines.append(f"Image [{idx}] — PREVIOUS | {summarize_entry_for_prompt(prior)} | {meds_text}")
        image_payloads.append({
            "label": f"Image [{idx}] — PREVIOUS",
            "base64": encode_image(prior.photo_path)
        })

    header = [
        f"There are {len(prior_entries)} previous entries attached for timeline analysis.",
        "Images are indexed as shown below (oldest previous to newest, with CURRENT as [0]):",
    ]
    legend_header = "\n".join(header)
    legend = legend_header + "\n" + "\n".join(legend_lines)
    return legend, image_payloads

async def analyze_with_timeline(analysis_type: str, global_context: str, legend_text: str, images: List[Dict[str, str]]) -> Dict[str, Any]:
    if analysis_type == "hair":
        prompt = f"""
        You are a hair pattern analysis specialist. Analyze this set of hairline photos using the Norwood Scale classification system (stages 1-7).

        Respond in this exact JSON format:
        {{
            "norwood_score": 2,
            "observations": "Describe current hairline pattern in 2-3 sentences, include trend across timeline",
            "suggestions": "Provide care/styling suggestions and any trend-aware guidance",
            "treatment": "Recommend specific treatments based on the Norwood stage"
        }}

        Context: {global_context}

        IMPORTANT NORWOOD SCALE GUIDELINES:
        - Stage 0: No visible hair loss or recession
        - Stage 1: No visible hair loss or recession
        - Stage 2: Minimal recession at temples, forming mature hairline
        - Stage 3: Deeper temple recession, may have slight crown thinning
        - Stage 4: Significant temple recession with crown thinning becoming noticeable
        - Stage 5: Crown and temples merge, horseshoe pattern starts forming
        - Stage 6: Crown and temple areas mostly bald with bridge of hair
        - Stage 7: Severe hair loss with only sides and back remaining

        TREATMENT GUIDELINES BY NORWOOD STAGE:
        - Stage 0-1: Castor oil, rosemary oil, scalp massage, biotin, vitamin D, zinc, omega-3 fatty acids
        - Stage 2: Ketoconazole 1–2% shampoo, minoxidil oral 2.5 mg, minoxidil topical 5%, low-level laser therapy
        - Stage 3: Finasteride 1 mg, minoxidil oral 2.5 mg, minoxidil topical 5%, microneedling
        - Stage 4: Dutasteride 0.5 mg, minoxidil 2.5 mg, PRP injections, exosome therapy, stem-cell–derived therapies
        - Stage 5-7: Dutasteride 0.5 mg, minoxidil 2.5 mg, hair transplant (FUE/FUT), scalp micropigmentation, wigs, hair systems

        REQUIREMENTS:
        - Be CONSERVATIVE in your estimates (choose lower stage when unsure)
        - Consider lighting and photo angle
        - Incorporate comparisons across the indexed images to note progression/regression
        - Select appropriate treatments from the guidelines above based on the determined Norwood stage
        """
    elif analysis_type == "skin_texture":
        prompt = f"""
        You are an image analysis AI. Analyze this set of photos for skin texture and appearance.

        Respond in this exact JSON format:
        {{
            "texture_level": "smooth",
            "observations": "Describe current texture in 2-3 sentences, include trend across timeline", 
            "suggestions": "Provide general routine suggestions informed by trends",
            "treatment": "Recommend specific acne treatments based on severity level"
        }}

        Context: {global_context}

        Focus on: skin texture, smoothness, overall appearance. Use texture_level values: "smooth", "textured", or "very_textured".
        
        ACNE TREATMENT GUIDELINES BY SEVERITY:
        - Mild (smooth to slightly textured): Benzoyl peroxide wash, salicylic acid cleansers, adapalene, tretinoin
        - Moderate (textured): Oral antibiotics (doxycycline, minocycline, azithromycin), clindamycin + benzoyl peroxide gel, tazarotene
        - Severe (very textured): Isotretinoin, oral contraceptives, spironolactone, chemical peels, laser therapy, microneedling

        REQUIREMENTS:
        - Emphasize changes over time using the indexed images
        - Select appropriate treatments from the guidelines above based on the determined texture level/severity
        """
    else:  # skin_feature
        prompt = f"""
        You are an image analysis AI. Analyze this set of photos for skin feature characteristics.

        Respond in this exact JSON format:
        {{
            "feature_regular": true,
            "observations": "Describe current feature characteristics in 2-3 sentences, include trend across timeline",
            "suggestions": "Provide monitoring and care suggestions considering changes over time",
            "treatment": "Recommend appropriate treatment based on feature characteristics"
        }}

        Context: {global_context}

        Focus on: feature shape, color uniformity, overall appearance. Use feature_regular as true for regular features, false for irregular.
        
        MOLE/SKIN LESION TREATMENT GUIDELINES:
        - Benign/Cosmetic (regular features): Shave excision, punch biopsy, laser ablation
        - Suspicious (irregular features): Dermoscopy, punch biopsy, excisional biopsy, wide local excision, sentinel lymph node biopsy
        - Cosmetic removal: Electrosurgery, radiofrequency ablation, plastic-surgical excision

        REQUIREMENTS:
        - Emphasize changes over time using the indexed images
        - Select appropriate treatments from the guidelines above based on feature regularity assessment
        - Always recommend professional consultation for suspicious features
        """

    try:
        print(f"DEBUG: Making OpenAI request for {analysis_type} analysis with timeline...")
        async with AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY")) as client:
            # Build interleaved text + image content, labeling each image
            content_parts: List[Dict[str, Any]] = [
                {"type": "text", "text": prompt},
                {"type": "text", "text": "TIMELINE OVERVIEW:"},
                {"type": "text", "text": legend_text}
            ]
            for img in images:
                content_parts.append({"type": "text", "text": img["label"]})
                content_parts.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{img['base64']}"}
                })

            response = await client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a helpful image analysis assistant that describes visual characteristics of images. You provide objective observations without medical diagnosis."
                    },
                    {
                        "role": "user",
                        "content": content_parts
                    }
                ],
                max_tokens=600,
                temperature=0.3
            )

        print(f"DEBUG: OpenAI response received. Content: {response.choices[0].message.content}")
        return extract_json_from_response(response.choices[0].message.content)
    except Exception as e:
        print(f"DEBUG: Exception in analyze_with_timeline: {str(e)}")
        # Fallback per analysis type
        if analysis_type == "hair":
            return {
                "norwood_score": 2,
                "observations": "Unable to analyze hairline pattern with timeline at this time",
                "suggestions": "Consider consulting a hair care professional for proper assessment",
                "treatment": "Ketoconazole 1–2% shampoo, minoxidil oral 2.5 mg, minoxidil topical 5%, low-level laser therapy"
            }
        elif analysis_type == "skin_texture":
            return {
                "texture_level": "textured",
                "observations": "Unable to analyze images with timeline at this time",
                "suggestions": "Consider consulting a skincare professional",
                "treatment": "Oral antibiotics (doxycycline, minocycline, azithromycin), clindamycin + benzoyl peroxide gel, tazarotene"
            }
        else:
            return {
                "feature_regular": True,
                "observations": "Unable to analyze images with timeline at this time",
                "suggestions": "Consider regular monitoring and professional consultation",
                "treatment": "Dermoscopy, punch biopsy, excisional biopsy, wide local excision, sentinel lymph node biopsy"
            }

async def analyze_image_generic(base64_image: str, analysis_type: str, context: str) -> Dict[str, Any]:
    """Generic image analysis function that avoids medical terminology"""
    
    if analysis_type == "hair":
        prompt = f"""
        You are a hair pattern analysis specialist. Analyze this hairline photo using the Norwood Scale classification system (stages 1-7).
        
        Please respond in this exact JSON format:
        {{
            "norwood_score": 2,
            "observations": "Describe the hairline recession pattern, temple areas, crown thinning, and overall hair density in 2-3 sentences",
            "suggestions": "Provide hair care recommendations and styling suggestions based on the current pattern",
            "treatment": "Recommend specific treatments based on the Norwood stage"
        }}
        
        Context: {context}
        
        IMPORTANT NORWOOD SCALE GUIDELINES:
        - Stage 0: No visible hair loss or recession
        - Stage 1: No visible hair loss or recession
        - Stage 2: Minimal recession at temples, forming mature hairline
        - Stage 3: Deeper temple recession, may have slight crown thinning
        - Stage 4: Significant temple recession with crown thinning becoming noticeable
        - Stage 5: Crown and temples merge, horseshoe pattern starts forming
        - Stage 6: Crown and temple areas mostly bald with bridge of hair
        - Stage 7: Severe hair loss with only sides and back remaining
        
        TREATMENT GUIDELINES BY NORWOOD STAGE:
        - Stage 0-1: Castor oil, rosemary oil, scalp massage, biotin, vitamin D, zinc, omega-3 fatty acids
        - Stage 2: Ketoconazole 1–2% shampoo, minoxidil oral 2.5 mg, minoxidil topical 5%, low-level laser therapy
        - Stage 3: Finasteride 1 mg, minoxidil oral 2.5 mg, minoxidil topical 5%, microneedling
        - Stage 4: Dutasteride 0.5 mg, minoxidil 2.5 mg, PRP injections, exosome therapy, stem-cell–derived therapies
        - Stage 5-7: Dutasteride 0.5 mg, minoxidil 2.5 mg, hair transplant (FUE/FUT), scalp micropigmentation, wigs, hair systems
        
        ANALYSIS REQUIREMENTS:
        - Be CONSERVATIVE in your estimates - when in doubt, choose the lower stage
        - Focus on: temple recession depth, crown thinning visibility, overall pattern
        - Consider lighting and photo angle that might make hair loss appear worse than it is
        - Err on the side of underestimating rather than overestimating hair loss
        - Provide the norwood_score as an integer from 1-7
        - Select appropriate treatments from the guidelines above based on the determined Norwood stage
        """
        
    elif analysis_type == "skin_texture":
        prompt = f"""
        You are an image analysis AI. Analyze this photo and describe what you see regarding skin texture, appearance, and condition.
        
        Please respond in this exact JSON format:
        {{
            "texture_level": "smooth",
            "observations": "Describe the skin texture and appearance in 2-3 sentences", 
            "suggestions": "Provide general skincare routine suggestions",
            "treatment": "Recommend specific acne treatments based on severity level"
        }}
        
        Context: {context}
        
        Focus on: skin texture, smoothness, overall appearance. Use texture_level values: "smooth", "textured", or "very_textured".
        
        ACNE TREATMENT GUIDELINES BY SEVERITY:
        - Mild (smooth to slightly textured): Benzoyl peroxide wash, salicylic acid cleansers, adapalene, tretinoin
        - Moderate (textured): Oral antibiotics (doxycycline, minocycline, azithromycin), clindamycin + benzoyl peroxide gel, tazarotene
        - Severe (very textured): Isotretinoin, oral contraceptives, spironolactone, chemical peels, laser therapy, microneedling
        
        REQUIREMENTS:
        - Select appropriate treatments from the guidelines above based on the determined texture level/severity
        """
        
    elif analysis_type == "skin_feature":
        prompt = f"""
        You are an image analysis AI. Analyze this photo and describe what you see regarding skin features and characteristics.
        
        Please respond in this exact JSON format:
        {{
            "feature_regular": true,
            "observations": "Describe the skin feature characteristics in 2-3 sentences",
            "suggestions": "Provide general monitoring and care suggestions",
            "treatment": "Recommend appropriate treatment based on feature characteristics"
        }}
        
        Context: {context}
        
        Focus on: feature shape, color uniformity, overall appearance. Use feature_regular as true for regular features, false for irregular.
        
        MOLE/SKIN LESION TREATMENT GUIDELINES:
        - Benign/Cosmetic (regular features): Shave excision, punch biopsy, laser ablation
        - Suspicious (irregular features): Dermoscopy, punch biopsy, excisional biopsy, wide local excision, sentinel lymph node biopsy
        - Cosmetic removal: Electrosurgery, radiofrequency ablation, plastic-surgical excision
        
        REQUIREMENTS:
        - Select appropriate treatments from the guidelines above based on feature regularity assessment
        - Always recommend professional consultation for suspicious features
        """
    
    try:
        print(f"DEBUG: Making OpenAI request for {analysis_type} analysis...")
        async with AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY")) as client:
            response = await client.chat.completions.create(
                model="gpt-4o",  # Using mini model which is less restrictive
                messages=[
                    {
                        "role": "system", 
                        "content": "You are a helpful image analysis assistant that describes visual characteristics of images. You provide objective observations without medical diagnosis."
                    },
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=600,
                temperature=0.3
            )
        
        print(f"DEBUG: OpenAI response received. Content: {response.choices[0].message.content}")
        return extract_json_from_response(response.choices[0].message.content)
        
    except Exception as e:
        print(f"DEBUG: Exception in analyze_image_generic: {str(e)}")
        # Return a basic fallback response
        if analysis_type == "hair":
            return {
                "norwood_score": 2,
                "observations": "Unable to analyze hairline pattern at this time",
                "suggestions": "Consider consulting a hair care professional for proper assessment",
                "treatment": "Ketoconazole 1–2% shampoo, minoxidil oral 2.5 mg, minoxidil topical 5%, low-level laser therapy"
            }
        elif analysis_type == "skin_texture":
            return {
                "texture_level": "textured",
                "observations": "Unable to analyze image at this time",
                "suggestions": "Consider consulting a skincare professional",
                "treatment": "Oral antibiotics (doxycycline, minocycline, azithromycin), clindamycin + benzoyl peroxide gel, tazarotene"
            }
        else:  # skin_feature
            return {
                "feature_regular": True,
                "observations": "Unable to analyze image at this time", 
                "suggestions": "Consider regular monitoring and professional consultation",
                "treatment": "Dermoscopy, punch biopsy, excisional biopsy, wide local excision, sentinel lymph node biopsy"
            }

async def get_hairline_feedback(entry: HairlineEntry) -> Dict[str, Any]:
    medications = await get_current_medications(entry.user_id, MedicationCategory.HAIRLINE)
    
    context = f"""
    User medications (current): {medications}
    User notes: {entry.user_notes or 'None'}
    User concerns: {entry.user_concerns or 'None'}
    """
    legend_text, images = await build_timeline_payload(entry, "hair")
    
    try:
        result = await analyze_with_timeline("hair", context, legend_text, images)
        
        # Map generic response to expected format
        mapped_result = {
            "Norwood": result.get("norwood_score", 2),
            "Comments": result.get("observations", "Hairline pattern analysis completed"),
            "Recommendations": result.get("suggestions", "Consider consulting a hair care professional"),
            "Treatment": result.get("treatment", "Ketoconazole 1–2% shampoo, minoxidil oral 2.5 mg, minoxidil topical 5%, low-level laser therapy")
        }
        
        # Update entry with AI feedback
        entry.norwood_score = mapped_result["Norwood"]
        entry.ai_comments = mapped_result["Comments"]
        entry.recommendations = mapped_result["Recommendations"]
        entry.treatment = mapped_result["Treatment"]
        await entry.save()
        
        return mapped_result
        
    except Exception as e:
        print(f"DEBUG: Exception in get_hairline_feedback: {str(e)}")
        # Fallback response if AI fails
        fallback_result = {
            "Norwood": 2,
            "Comments": f"Hairline analysis unavailable: {str(e)}",
            "Recommendations": "Please consult with a hair care professional for evaluation.",
            "Treatment": "Ketoconazole 1–2% shampoo, minoxidil oral 2.5 mg, minoxidil topical 5%, low-level laser therapy"
        }
        
        entry.norwood_score = 2
        entry.ai_comments = fallback_result["Comments"]
        entry.recommendations = fallback_result["Recommendations"]
        entry.treatment = fallback_result["Treatment"]
        await entry.save()
        
        return fallback_result

async def get_acne_feedback(entry: AcneEntry) -> Dict[str, Any]:
    medications = await get_current_medications(entry.user_id, MedicationCategory.ACNE)
    
    context = f"""
    User medications (current): {medications}
    User notes: {entry.user_notes or 'None'}
    User concerns: {entry.user_concerns or 'None'}
    """
    legend_text, images = await build_timeline_payload(entry, "skin_texture")
    
    try:
        result = await analyze_with_timeline("skin_texture", context, legend_text, images)
        
        # Map generic response to expected format
        mapped_result = {
            "SeverityLevel": result.get("texture_level", "textured").replace("very_textured", "severe").replace("textured", "moderate").replace("smooth", "mild"),
            "Comments": result.get("observations", "Skin texture analysis completed"),
            "Recommendations": result.get("suggestions", "Consider consulting a skincare professional"),
            "Treatment": result.get("treatment", "Oral antibiotics (doxycycline, minocycline, azithromycin), clindamycin + benzoyl peroxide gel, tazarotene")
        }
        
        # Update entry with AI feedback
        entry.severity_level = mapped_result["SeverityLevel"]
        entry.ai_comments = mapped_result["Comments"]
        entry.recommendations = mapped_result["Recommendations"]
        entry.treatment = mapped_result["Treatment"]
        await entry.save()
        
        return mapped_result
        
    except Exception as e:
        print(f"DEBUG: Exception in get_acne_feedback: {str(e)}")
        # Fallback response if AI fails
        fallback_result = {
            "SeverityLevel": "mild",
            "Comments": f"Image analysis unavailable: {str(e)}",
            "Recommendations": "Please consult with a skincare professional for evaluation.",
            "Treatment": "Benzoyl peroxide wash, salicylic acid cleansers, adapalene, tretinoin"
        }
        
        entry.severity_level = "mild"
        entry.ai_comments = fallback_result["Comments"]
        entry.recommendations = fallback_result["Recommendations"]
        entry.treatment = fallback_result["Treatment"]
        await entry.save()
        
        return fallback_result

async def get_mole_feedback(entry: MoleEntry) -> Dict[str, Any]:
    medications = await get_current_medications(entry.user_id, MedicationCategory.MOLE)
    
    context = f"""
    User medications (current): {medications}
    User notes: {entry.user_notes or 'None'}
    User concerns: {entry.user_concerns or 'None'}
    """
    legend_text, images = await build_timeline_payload(entry, "skin_feature")
    
    try:
        result = await analyze_with_timeline("skin_feature", context, legend_text, images)
        
        # Map generic response to expected format
        mapped_result = {
            "IrregularitiesDetected": not result.get("feature_regular", True),
            "Comments": result.get("observations", "Skin feature analysis completed"),
            "Recommendations": result.get("suggestions", "Consider regular monitoring and professional consultation"),
            "Treatment": result.get("treatment", "Dermoscopy, punch biopsy, excisional biopsy, wide local excision, sentinel lymph node biopsy")
        }
        
        # Update entry with AI feedback
        entry.irregularities_detected = mapped_result["IrregularitiesDetected"]
        entry.ai_comments = mapped_result["Comments"]
        entry.recommendations = mapped_result["Recommendations"]
        entry.treatment = mapped_result["Treatment"]
        await entry.save()
        
        return mapped_result
        
    except Exception as e:
        print(f"DEBUG: Exception in get_mole_feedback: {str(e)}")
        # Fallback response if AI fails
        fallback_result = {
            "IrregularitiesDetected": False,
            "Comments": f"Image analysis unavailable: {str(e)}",
            "Recommendations": "Please consult with a professional for evaluation.",
            "Treatment": "Shave excision, punch biopsy, laser ablation"
        }
        
        entry.irregularities_detected = False
        entry.ai_comments = fallback_result["Comments"]
        entry.recommendations = fallback_result["Recommendations"]
        entry.treatment = fallback_result["Treatment"]
        await entry.save()
        
        return fallback_result
