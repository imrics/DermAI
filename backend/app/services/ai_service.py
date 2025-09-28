import os
import base64
import json
import re
import logging
import traceback
from typing import Dict, Any, List, Tuple
import google.generativeai as genai
from app.models import HairlineEntry, MoleEntry, AcneEntry, Medication, MedicationCategory, Entry
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def encode_image(image_path: str) -> str:
    try:
        with open(image_path, "rb") as image_file:
            image_data = image_file.read()
            encoded = base64.b64encode(image_data).decode('utf-8')
            logger.info(f"Successfully encoded image: {image_path} ({len(encoded)} chars)")
            return encoded
    except Exception as e:
        logger.error(f"Failed to encode image {image_path}: {type(e).__name__}: {str(e)}")
        # Return a minimal valid base64 string as fallback
        return base64.b64encode(b"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==").decode('utf-8')

def parse_treatment_string(treatment_str: str) -> List[str]:
    """Parse treatment string into array of individual treatments with title case"""
    if not treatment_str:
        return []
    
    # Split by common delimiters and clean up
    treatments = []
    # Split by comma first
    parts = treatment_str.split(',')
    
    for part in parts:
        # Clean up whitespace and apply title case
        cleaned = part.strip()
        if cleaned:
            # Apply title case while preserving specific formatting like percentages and dosages
            treatments.append(cleaned.title())
    
    return treatments

def extract_json_from_response(response_text: str) -> Dict[str, Any]:
    """Extract JSON from AI response, handling cases where response contains extra text"""
    logger.info(f"Processing AI response: {len(response_text)} characters")

    try:
        # First try to parse as direct JSON
        result = json.loads(response_text)
        logger.info(f"Successfully parsed JSON response: {result}")
        return result
    except json.JSONDecodeError as e:
        logger.warning(f"JSON decode error: {e}")
        # Try to find JSON within the response text
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if json_match:
            try:
                result = json.loads(json_match.group())
                logger.info(f"Successfully extracted JSON from text: {result}")
                return result
            except json.JSONDecodeError as e2:
                logger.error(f"Failed to parse extracted JSON: {e2}")

        # If no valid JSON found, return a default structure
        logger.warning(f"Falling back to default structure. Original response length: {len(response_text)}")
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
        treatment_str = ", ".join(e.treatment) if isinstance(e.treatment, list) else str(e.treatment)
        parts.append(f"Prev AI treatment: {treatment_str}")
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
    logger.info(f"Starting timeline analysis for {analysis_type} with {len(images)} images")
    logger.debug(f"Legend text length: {len(legend_text)} characters")

    # Configure Gemini API
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.error("GEMINI_API_KEY not found in environment")
        raise ValueError("GEMINI_API_KEY not configured")

    try:
        genai.configure(api_key=api_key)
        logger.info("Gemini API configured successfully")
    except Exception as e:
        logger.error(f"Failed to configure Gemini API: {type(e).__name__}: {str(e)}")
        raise

    # Initialize Gemini model
    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        logger.info("Gemini model initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Gemini model: {type(e).__name__}: {str(e)}")
        raise

    if analysis_type == "hair":
        prompt = f"""
        You are a hair pattern analysis specialist. Analyze this set of hairline photos using the Norwood Scale classification system (stages 0-7).

        Respond in this exact JSON format:
        {{
            "norwood_score": 2,
            "observations": "Describe current hairline pattern in 2-3 sentences, include trend across timeline",
            "suggestions": "Provide care/styling suggestions and any trend-aware guidance",
            "treatment": "List specific treatments separated by commas, no explanations"
        }}

        Context: {global_context}

        IMPORTANT NORWOOD SCALE GUIDELINES:
        - Stage 0: No visible hair loss or recession
        - Stage 1: Minimal recession at temples, forming mature hairline
        - Stage 2: Deeper temple recession, may have slight crown thinning
        - Stage 3: Significant temple recession with crown thinning becoming noticeable
        - Stage 4: Crown and temples merge, horseshoe pattern starts forming
        - Stage 5: Crown and temple areas mostly bald with bridge of hair
        - Stage 6: Severe hair loss with only sides and back remaining
        - Stage 7: Completely bald

        TREATMENT GUIDELINES BY NORWOOD STAGE:
        - Stage 0-1: Scalp massage, biotin supplements, rosemary oil
        - Stage 2: Ketoconazole shampoo, minoxidil topical, low-level laser therapy
        - Stage 3: Finasteride, minoxidil topical, microneedling
        - Stage 4: Dutasteride, minoxidil oral, PRP injections
        - Stage 5-7: Hair transplant, scalp micropigmentation, dutasteride

        REQUIREMENTS:
        - Be CONSERVATIVE in your estimates (choose lower stage when unsure)
        - Consider lighting and photo angle
        - Incorporate comparisons across the indexed images to note progression/regression
        - Select appropriate treatments from the guidelines above based on the determined Norwood stage
        - MAXIMUM 3 treatments only
        - NO prescription drugs for Norwood stages 0-1 (only natural/topical options)
        - For treatment field: provide ONLY comma-separated treatment names, no explanations or connecting words
        - Use title case for treatment names
        - Example treatment format: "Ketoconazole Shampoo, Minoxidil Topical, Low-Level Laser Therapy"
        """
    elif analysis_type == "skin_texture":
        prompt = f"""
        You are an image analysis AI. Analyze this set of photos for skin texture and appearance.

        Respond in this exact JSON format:
        {{
            "texture_level": "smooth",
            "observations": "Describe current texture in 2-3 sentences, include trend across timeline", 
            "suggestions": "Provide general routine suggestions informed by trends",
            "treatment": "List specific acne treatments separated by commas, no explanations"
        }}

        Context: {global_context}

        Focus on: skin texture, smoothness, overall appearance. Use texture_level values: "smooth", "textured", or "very_textured".
        
        ACNE TREATMENT GUIDELINES BY SEVERITY:
        - Mild (smooth to slightly textured): Benzoyl peroxide wash, salicylic acid cleanser, gentle moisturizer
        - Moderate (textured): Adapalene gel, benzoyl peroxide, clindamycin gel
        - Severe (very textured): Tretinoin, oral antibiotics, isotretinoin

        REQUIREMENTS:
        - Emphasize changes over time using the indexed images
        - Select appropriate treatments from the guidelines above based on the determined texture level/severity
        - MAXIMUM 3 treatments only
        - Be conservative with prescription medications
        - For treatment field: provide ONLY comma-separated treatment names, no explanations or connecting words
        - Use title case for treatment names
        - Example treatment format: "Benzoyl Peroxide Wash, Salicylic Acid Cleanser, Gentle Moisturizer"
        """
    else:  # skin_feature
        prompt = f"""
        You are an image analysis AI. Analyze this set of photos for skin feature characteristics.

        Respond in this exact JSON format:
        {{
            "feature_regular": true,
            "observations": "Describe current feature characteristics in 2-3 sentences, include trend across timeline",
            "suggestions": "Provide monitoring and care suggestions considering changes over time",
            "treatment": "List specific treatments separated by commas, no explanations"
        }}

        Context: {global_context}

        Focus on: feature shape, color uniformity, overall appearance. Use feature_regular as true for regular features, false for irregular.
        
        MOLE/SKIN LESION TREATMENT GUIDELINES:
        - Benign/Regular features: Regular monitoring, professional consultation, dermoscopy
        - Suspicious/Irregular features: Dermoscopy, biopsy, professional evaluation
        - Cosmetic concerns: Professional consultation, laser treatment, surgical removal

        REQUIREMENTS:
        - Emphasize changes over time using the indexed images
        - Select appropriate treatments from the guidelines above based on feature regularity assessment
        - Always recommend professional consultation for suspicious features
        - MAXIMUM 3 treatments only
        - Be conservative and prioritize professional evaluation
        - For treatment field: provide ONLY comma-separated treatment names, no explanations or connecting words
        - Use title case for treatment names
        - Example treatment format: "Regular Monitoring, Professional Consultation, Dermoscopy"
        """

    try:
        logger.info(f"Making Gemini request for {analysis_type} analysis with timeline...")

        # Build content parts for Gemini
        content_parts = [prompt + "\n\nTIMELINE OVERVIEW:\n" + legend_text]
        logger.debug(f"Built prompt with legend, total content parts: 1 (prompt)")

        # Add images to content parts
        image_count = 0
        for img in images:
            content_parts.append(img["label"])
            image_count += 1
            logger.debug(f"Added label for image {image_count}: {img['label']}")

            # Convert base64 to PIL Image for Gemini
            try:
                import io
                from PIL import Image
                image_data = base64.b64decode(img["base64"])
                logger.debug(f"Decoded base64 data for image {image_count}, size: {len(image_data)} bytes")
                image = Image.open(io.BytesIO(image_data))
                content_parts.append(image)
                logger.info(f"Successfully processed image {image_count} ({img['label']}) for Gemini")
            except ImportError as e:
                logger.warning(f"PIL import failed for image {image_count}: {e}")
                # Fallback to base64 data
                content_parts.append({
                    "mime_type": "image/jpeg",
                    "data": img["base64"]
                })
                logger.info(f"Used base64 fallback for image {image_count}")
            except Exception as e:
                logger.error(f"Failed to process image {image_count} ({img['label']}): {type(e).__name__}: {str(e)}")
                # Fallback to base64 data
                content_parts.append({
                    "mime_type": "image/jpeg",
                    "data": img["base64"]
                })
                logger.info(f"Used base64 fallback for image {image_count} due to error")

        logger.info(f"Prepared {len(content_parts)} content parts for Gemini API call")

        response = model.generate_content(
            content_parts,
            generation_config=genai.types.GenerationConfig(
                temperature=0.3,
                top_p=0.9,
                top_k=40
            )
        )

        logger.info(f"Gemini response received. Content length: {len(response.text)} characters")
        return extract_json_from_response(response.text)
    except Exception as e:
        logger.error(f"Exception in analyze_with_timeline: {type(e).__name__}: {str(e)}")
        logger.debug(f"Full traceback: {traceback.format_exc()}")
        # Fallback per analysis type
        if analysis_type == "hair":
            return {
                "norwood_score": 2,
                "observations": "Unable to analyze hairline pattern with timeline at this time",
                "suggestions": "Consider consulting a hair care professional for proper assessment",
                "treatment": "Ketoconazole Shampoo, Minoxidil Topical, Low-Level Laser Therapy"
            }
        elif analysis_type == "skin_texture":
            return {
                "texture_level": "textured",
                "observations": "Unable to analyze images with timeline at this time",
                "suggestions": "Consider consulting a skincare professional",
                "treatment": "Benzoyl Peroxide Wash, Salicylic Acid Cleanser, Gentle Moisturizer"
            }
        else:
            return {
                "feature_regular": True,
                "observations": "Unable to analyze images with timeline at this time",
                "suggestions": "Consider regular monitoring and professional consultation",
                "treatment": "Regular Monitoring, Professional Consultation, Dermoscopy"
            }

async def analyze_image_generic(base64_image: str, analysis_type: str, context: str) -> Dict[str, Any]:
    """Generic image analysis function that avoids medical terminology"""

    # Configure Gemini API
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

    # Initialize Gemini model
    model = genai.GenerativeModel("gemini-2.5-flash")

    if analysis_type == "hair":
        prompt = f"""
        You are a hair pattern analysis specialist. Analyze this hairline photo using the Norwood Scale classification system (stages 1-7).
        
        Please respond in this exact JSON format:
        {{
            "norwood_score": 2,
            "observations": "Describe the hairline recession pattern, temple areas, crown thinning, and overall hair density in 2-3 sentences",
            "suggestions": "Provide hair care recommendations and styling suggestions based on the current pattern",
            "treatment": "List specific treatments separated by commas, no explanations"
        }}
        
        Context: {context}
        
        IMPORTANT NORWOOD SCALE GUIDELINES:
        - Stage 0: No visible hair loss or recession
        - Stage 1: Minimal recession at temples, forming mature hairline
        - Stage 2: Deeper temple recession, may have slight crown thinning
        - Stage 3: Significant temple recession with crown thinning becoming noticeable
        - Stage 4: Crown and temples merge, horseshoe pattern starts forming
        - Stage 5: Crown and temple areas mostly bald with bridge of hair
        - Stage 6: Severe hair loss with only sides and back remaining
        - Stage 7: Completely Bald
        
        TREATMENT GUIDELINES BY NORWOOD STAGE:
        - Stage 0-1: Scalp massage, biotin supplements, rosemary oil
        - Stage 2: Ketoconazole shampoo, minoxidil topical, low-level laser therapy
        - Stage 3: Finasteride, minoxidil topical, microneedling
        - Stage 4: Dutasteride, minoxidil oral, PRP injections
        - Stage 5-7: Hair transplant, scalp micropigmentation, dutasteride
        
        ANALYSIS REQUIREMENTS:
        - Be CONSERVATIVE in your estimates - when in doubt, choose the lower stage
        - Focus on: temple recession depth, crown thinning visibility, overall pattern
        - Consider lighting and photo angle that might make hair loss appear worse than it is
        - Err on the side of underestimating rather than overestimating hair loss
        - Provide the norwood_score as an integer from 1-7
        - Select appropriate treatments from the guidelines above based on the determined Norwood stage
        - MAXIMUM 3 treatments only
        - NO prescription drugs for Norwood stages 0-1 (only natural/topical options)
        - For treatment field: provide ONLY comma-separated treatment names, no explanations or connecting words
        - Use title case for treatment names
        - Example treatment format: "Ketoconazole Shampoo, Minoxidil Topical, Low-Level Laser Therapy"
        """
        
    elif analysis_type == "skin_texture":
        prompt = f"""
        You are an image analysis AI. Analyze this photo and describe what you see regarding skin texture, appearance, and condition.
        
        Please respond in this exact JSON format:
        {{
            "texture_level": "smooth",
            "observations": "Describe the skin texture and appearance in 2-3 sentences", 
            "suggestions": "Provide general skincare routine suggestions",
            "treatment": "List specific acne treatments separated by commas, no explanations"
        }}
        
        Context: {context}
        
        Focus on: skin texture, smoothness, overall appearance. Use texture_level values: "smooth", "textured", or "very_textured".
        
        ACNE TREATMENT GUIDELINES BY SEVERITY:
        - Mild (smooth to slightly textured): Benzoyl peroxide wash, salicylic acid cleanser, gentle moisturizer
        - Moderate (textured): Adapalene gel, benzoyl peroxide, clindamycin gel
        - Severe (very textured): Tretinoin, oral antibiotics, isotretinoin
        
        REQUIREMENTS:
        - Select appropriate treatments from the guidelines above based on the determined texture level/severity
        - MAXIMUM 3 treatments only
        - Be conservative with prescription medications
        - For treatment field: provide ONLY comma-separated treatment names, no explanations or connecting words
        - Use title case for treatment names
        - Example treatment format: "Benzoyl Peroxide Wash, Salicylic Acid Cleanser, Gentle Moisturizer"
        """
        
    elif analysis_type == "skin_feature":
        prompt = f"""
        You are an image analysis AI. Analyze this photo and describe what you see regarding skin features and characteristics.
        
        Please respond in this exact JSON format:
        {{
            "feature_regular": true,
            "observations": "Describe the skin feature characteristics in 2-3 sentences",
            "suggestions": "Provide general monitoring and care suggestions",
            "treatment": "List specific treatments separated by commas, no explanations"
        }}
        
        Context: {context}
        
        Focus on: feature shape, color uniformity, overall appearance. Use feature_regular as true for regular features, false for irregular.
        
        MOLE/SKIN LESION TREATMENT GUIDELINES:
        - Benign/Regular features: Regular monitoring, professional consultation, dermoscopy
        - Suspicious/Irregular features: Dermoscopy, biopsy, professional evaluation
        - Cosmetic concerns: Professional consultation, laser treatment, surgical removal
        
        REQUIREMENTS:
        - Select appropriate treatments from the guidelines above based on feature regularity assessment
        - Always recommend professional consultation for suspicious features
        - MAXIMUM 3 treatments only
        - Be conservative and prioritize professional evaluation
        - For treatment field: provide ONLY comma-separated treatment names, no explanations or connecting words
        - Use title case for treatment names
        - Example treatment format: "Regular Monitoring, Professional Consultation, Dermoscopy"
        """
    
    try:
        print(f"DEBUG: Making Gemini request for {analysis_type} analysis...")

        # Build content for Gemini
        try:
            import io
            from PIL import Image
            image_data = base64.b64decode(base64_image)
            image = Image.open(io.BytesIO(image_data))
            content_parts = [prompt, image]
        except ImportError as e:
            print(f"DEBUG: PIL import failed: {e}")
            # Fallback to base64 data
            content_parts = [prompt, {
                "mime_type": "image/jpeg",
                "data": base64_image
            }]

        response = model.generate_content(
            content_parts,
            generation_config=genai.types.GenerationConfig(
                temperature=0.3,
                top_p=0.9,
                top_k=40
            )
        )

        print(f"DEBUG: Gemini response received. Content: {response.text}")
        return extract_json_from_response(response.text)
        
    except Exception as e:
        print(f"DEBUG: Exception in analyze_image_generic: {str(e)}")
        # Return a basic fallback response
        if analysis_type == "hair":
            return {
                "norwood_score": 2,
                "observations": "Unable to analyze hairline pattern at this time",
                "suggestions": "Consider consulting a hair care professional for proper assessment",
                "treatment": "Ketoconazole Shampoo, Minoxidil Topical, Low-Level Laser Therapy"
            }
        elif analysis_type == "skin_texture":
            return {
                "texture_level": "textured",
                "observations": "Unable to analyze image at this time",
                "suggestions": "Consider consulting a skincare professional",
                "treatment": "Benzoyl Peroxide Wash, Salicylic Acid Cleanser, Gentle Moisturizer"
            }
        else:  # skin_feature
            return {
                "feature_regular": True,
                "observations": "Unable to analyze image at this time", 
                "suggestions": "Consider regular monitoring and professional consultation",
                "treatment": "Regular Monitoring, Professional Consultation, Dermoscopy"
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
            "Treatment": result.get("treatment", "Ketoconazole Shampoo, Minoxidil Topical, Low-Level Laser Therapy")
        }
        
        # Update entry with AI feedback
        entry.norwood_score = mapped_result["Norwood"]
        entry.ai_comments = mapped_result["Comments"]
        entry.recommendations = mapped_result["Recommendations"]
        entry.treatment = parse_treatment_string(mapped_result["Treatment"])
        await entry.save()
        
        return mapped_result
        
    except Exception as e:
        print(f"DEBUG: Exception in get_hairline_feedback: {str(e)}")
        # Fallback response if AI fails
        fallback_result = {
            "Norwood": 2,
            "Comments": f"Hairline analysis unavailable: {str(e)}",
            "Recommendations": "Please consult with a hair care professional for evaluation.",
            "Treatment": "Ketoconazole Shampoo, Minoxidil Topical, Low-Level Laser Therapy"
        }
        
        entry.norwood_score = 2
        entry.ai_comments = fallback_result["Comments"]
        entry.recommendations = fallback_result["Recommendations"]
        entry.treatment = parse_treatment_string(fallback_result["Treatment"])
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
            "Treatment": result.get("treatment", "Benzoyl Peroxide Wash, Salicylic Acid Cleanser, Gentle Moisturizer")
        }
        
        # Update entry with AI feedback
        entry.severity_level = mapped_result["SeverityLevel"]
        entry.ai_comments = mapped_result["Comments"]
        entry.recommendations = mapped_result["Recommendations"]
        entry.treatment = parse_treatment_string(mapped_result["Treatment"])
        await entry.save()
        
        return mapped_result
        
    except Exception as e:
        print(f"DEBUG: Exception in get_acne_feedback: {str(e)}")
        # Fallback response if AI fails
        fallback_result = {
            "SeverityLevel": "mild",
            "Comments": f"Image analysis unavailable: {str(e)}",
            "Recommendations": "Please consult with a skincare professional for evaluation.",
            "Treatment": "Benzoyl Peroxide Wash, Salicylic Acid Cleanser, Gentle Moisturizer"
        }
        
        entry.severity_level = "mild"
        entry.ai_comments = fallback_result["Comments"]
        entry.recommendations = fallback_result["Recommendations"]
        entry.treatment = parse_treatment_string(fallback_result["Treatment"])
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
            "Treatment": result.get("treatment", "Regular Monitoring, Professional Consultation, Dermoscopy")
        }
        
        # Update entry with AI feedback
        entry.irregularities_detected = mapped_result["IrregularitiesDetected"]
        entry.ai_comments = mapped_result["Comments"]
        entry.recommendations = mapped_result["Recommendations"]
        entry.treatment = parse_treatment_string(mapped_result["Treatment"])
        await entry.save()
        
        return mapped_result
        
    except Exception as e:
        print(f"DEBUG: Exception in get_mole_feedback: {str(e)}")
        # Fallback response if AI fails
        fallback_result = {
            "IrregularitiesDetected": False,
            "Comments": f"Image analysis unavailable: {str(e)}",
            "Recommendations": "Please consult with a professional for evaluation.",
            "Treatment": "Regular Monitoring, Professional Consultation, Dermoscopy"
        }
        
        entry.irregularities_detected = False
        entry.ai_comments = fallback_result["Comments"]
        entry.recommendations = fallback_result["Recommendations"]
        entry.treatment = parse_treatment_string(fallback_result["Treatment"])
        await entry.save()
        
        return fallback_result
