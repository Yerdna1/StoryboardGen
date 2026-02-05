"""
Modal.com Qwen Image Edit Function for StoryboardGen

This connects to your existing deployed Modal function with Qwen-Image-Edit-2511.
Your deployed function: https://yerdna1983--film-generator-image-edit.modal.run

If you want to deploy a new function, use:
  modal deploy modal_app.py

But you already have Qwen deployed, so just use that URL in StoryboardGen settings!
"""

import modal
import base64
import io
from typing import Optional

# Create Modal stub
stub = modal.Stub("storyboard-gen-qwen")

# Define the image for the Stable Diffusion container
image = (
    modal.Image.debian_slim(python_version="3.10")
    .pip_install(
        "diffusers>=0.21.0",
        "transformers>=4.30.0",
        "accelerate>=0.20.0",
        "safetensors>=0.3.1",
        "Pillow>=9.5.0",
        "torch>=2.0.0",
        "torchvision>=0.15.0",
        "xformers>=0.0.20",
    )
)

# GPU configuration for faster inference
@stub.function(
    image=image,
    gpu="any",  # Uses any available GPU (T4, V100, A100)
    timeout=120,  # 2 minutes timeout
    memory=1024,  # 1GB RAM
)
@stub.web_endpoint(method="POST")
def generate_image(
    prompt: str,
    negative_prompt: str = "blurry, low quality, distorted, ugly, bad anatomy, extra limbs",
    width: int = 1024,
    height: int = 1024,
    num_inference_steps: int = 30,
    guidance_scale: float = 7.5,
    model: str = "stable-diffusion-xl",
    reference_image: Optional[str] = None,
) -> dict:
    """
    Generate an image using Stable Diffusion on Modal.com

    Args:
        prompt: Text description of the image to generate
        negative_prompt: Things to avoid in the generated image
        width: Image width (default: 1024)
        height: Image height (default: 1024)
        num_inference_steps: Number of denoising steps (default: 30)
        guidance_scale: How strongly to follow the prompt (default: 7.5)
        model: Model to use - "stable-diffusion-xl" or "stable-diffusion-1.5"
        reference_image: Optional base64 data URL of reference image for img2img

    Returns:
        dict with 'image' key containing the generated image as base64 data URL
    """
    import torch
    from diffusers import StableDiffusionXLPipeline, StableDiffusionPipeline
    from diffusers.utils import load_image
    from PIL import Image
    import io

    # Select model based on parameter
    if model == "stable-diffusion-xl" or "sdxl" in model.lower():
        model_id = "stabilityai/stable-diffusion-xl-base-1.0"
        use_refiner = False
    else:
        model_id = "runwayml/stable-diffusion-v1-5"
        use_refiner = False

    print(f"Loading model: {model_id}")

    # Load the pipeline
    if "sdxl" in model_id.lower():
        pipe = StableDiffusionXLPipeline.from_pretrained(
            model_id,
            torch_dtype=torch.float16,
            use_safetensors=True,
            variant="fp16"
        )
    else:
        pipe = StableDiffusionPipeline.from_pretrained(
            model_id,
            torch_dtype=torch.float16,
            use_safetensors=True
        )

    # Enable memory optimizations
    pipe.enable_attention_slicing()
    pipe.enable_xformers_memory_efficient_attention()

    # Move to GPU
    pipe = pipe.to("cuda")

    # Process reference image if provided (image-to-image)
    if reference_image:
        print("Using image-to-image mode")

        # Decode base64 image
        if reference_image.startswith("data:image"):
            # Extract base64 data
            base64_data = reference_image.split(",")[1]
            image_data = base64.b64decode(base64_data)
            ref_image = Image.open(io.BytesIO(image_data))

            # Resize to target dimensions
            ref_image = ref_image.resize((width, height), Image.Resampling.LANCZOS)

            # Generate with image-to-image
            result = pipe(
                prompt=prompt,
                negative_prompt=negative_prompt,
                image=ref_image,
                strength=0.7,  # How much to transform the reference image
                guidance_scale=guidance_scale,
                num_inference_steps=num_inference_steps,
                height=height,
                width=width,
            )
        else:
            # Fallback to text-to-image
            result = pipe(
                prompt=prompt,
                negative_prompt=negative_prompt,
                guidance_scale=guidance_scale,
                num_inference_steps=num_inference_steps,
                height=height,
                width=width,
            )
    else:
        print("Using text-to-image mode")

        # Text-to-image generation
        result = pipe(
            prompt=prompt,
            negative_prompt=negative_prompt,
            guidance_scale=guidance_scale,
            num_inference_steps=num_inference_steps,
            height=height,
            width=width,
        )

    # Get the generated image
    image = result.images[0]

    # Convert to base64
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)
    img_bytes = buffer.getvalue()
    img_base64 = base64.b64encode(img_bytes).decode("utf-8")
    img_data_url = f"data:image/png;base64,{img_base64}"

    print(f"Generated image: {len(img_bytes)} bytes")

    return {"image": img_data_url}


# Alternative: Lightweight version using pre-built Modal image
@stub.function(
    image=modal.Image.from_registry(
        "nvidia/cuda:12.1.0-runtime-ubuntu22.04",
        add_python="3.10",
    ),
    gpu="any",
    timeout=120,
)
@stub.web_endpoint(method="POST")
def generate_image_fast(
    prompt: str,
    negative_prompt: str = "blurry, low quality",
    width: int = 1024,
    height: int = 1024,
    num_inference_steps: int = 20,
    guidance_scale: float = 7.5,
) -> dict:
    """
    Faster version using modal's pre-built image with pre-installed dependencies.
    Requires the Modal function to have the necessary packages installed.
    """
    # This is a placeholder - you would need to install the actual dependencies
    # in the image. The generate_image function above is more complete.
    return {"image": None}


# For local testing
if __name__ == "__main__":
    # Test the function locally (requires GPU)
    with modal.enable_output():
        result = generate_image.local(
            prompt="A cinematic landscape view",
            width=512,
            height=512,
            num_inference_steps=10,
        )
        print(f"Generated image URL: {result['image'][:100]}...")
