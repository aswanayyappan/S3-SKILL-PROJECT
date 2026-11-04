"""
S-3 IOT: PyTorch Electrical Transformer & Bias Rectifier Neural Network
Architecture:
- Multi-Head Self-Attention Transformer Feature Encoder
- Multi-Task Classification (Electrical States: IDLE, LED, PUMP, INRUSH, STALL, BIAS_ERROR)
- Calibrated True Power Regression Head
- Sensor Zero-Bias Rectification Offset Head
"""

import torch
import torch.nn as nn
import torch.nn.functional as F

class S3ElectricalTransformer(nn.Module):
    def __init__(self, input_dim=6, d_model=64, nhead=4, num_classes=6, dropout=0.1):
        super(S3ElectricalTransformer, self).__init__()
        
        self.input_dim = input_dim
        self.d_model = d_model
        
        # 1. Feature Embedding Projection
        self.input_proj = nn.Sequential(
            nn.Linear(input_dim, d_model),
            nn.LayerNorm(d_model),
            nn.GELU(),
            nn.Dropout(dropout)
        )
        
        # 2. Transformer Self-Attention Layer
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=nhead,
            dim_feedforward=128,
            dropout=dropout,
            activation="gelu",
            batch_first=True
        )
        self.transformer_encoder = nn.TransformerEncoder(encoder_layer, num_layers=2)
        
        # 3. Task Head 1: Electrical State & Anomaly Classifier
        self.classifier_head = nn.Sequential(
            nn.Linear(d_model, 32),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(32, num_classes)
        )
        
        # 4. Task Head 2: True Calibrated Power Predictor (Watts)
        self.power_head = nn.Sequential(
            nn.Linear(d_model, 32),
            nn.GELU(),
            nn.Linear(32, 1)
        )
        
        # 5. Task Head 3: Sensor Zero-Bias Rectification Head
        # Predicts [v_led_bias, c_led_bias, v_pump_bias, c_pump_bias]
        self.bias_head = nn.Sequential(
            nn.Linear(d_model, 32),
            nn.GELU(),
            nn.Linear(32, 4)
        )

    def forward(self, x):
        # x shape: (batch_size, input_dim) -> unsqueeze to (batch_size, 1, input_dim)
        if x.dim() == 2:
            x = x.unsqueeze(1)
            
        emb = self.input_proj(x)
        encoded = self.transformer_encoder(emb)
        pooled = encoded[:, 0, :] # Extract sequence embedding
        
        logits = self.classifier_head(pooled)
        power_pred = F.relu(self.power_head(pooled)) # Power is non-negative
        bias_offsets = self.bias_head(pooled)
        
        return {
            "logits": logits,
            "probabilities": F.softmax(logits, dim=-1),
            "predicted_power": power_pred.squeeze(-1),
            "predicted_bias": bias_offsets
        }

if __name__ == "__main__":
    model = S3ElectricalTransformer()
    dummy_input = torch.tensor([[1.183, 0.241, 1.183, 0.203, 0.285, 0.240]], dtype=torch.float32)
    output = model(dummy_input)
    print("PyTorch Model Initialized Successfully!")
    print("Logits shape:", output["logits"].shape)
    print("Class Probabilities:", output["probabilities"])
    print("Predicted Power:", output["predicted_power"].item())
    print("Predicted Bias Offsets:", output["predicted_bias"])

