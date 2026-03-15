from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pandas as pd
import numpy as np
import lightgbm as lgb
from sqlalchemy import create_engine
import os

app = FastAPI(title="Loyalty NBO Predictor (LightGBM)")

# Connect to the local PostgreSQL Database
DB_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgrespassword@localhost:5432/loyaltydb")
engine = create_engine(DB_URL)

# Global model cache for our LightGBM classifier
NBO_MODEL = None

def train_or_load_model():
    """
    Mocking a real Enterprise Data Pipeline:
    In production, this reads millions of rows from a Data Warehouse (Snowflake/BigQuery).
    For this MVP, we generate a synthetic dataset representing human behavior
    to train our LightGBM model so it functions as a TRUE mathematical tree-based classifier, 
    just on simulated data.
    """
    global NBO_MODEL
    if NBO_MODEL is not None:
        return NBO_MODEL

    # Simulate 1000 historical interactions
    np.random.seed(42)
    n_samples = 1000
    
    # Features: User Points Balance, Offer Points Required, Offer Category
    user_points = np.random.randint(0, 50000, n_samples)
    offer_points = np.random.randint(500, 10000, n_samples)
    
    # 0=Travel, 1=Hotel, 2=Dining, 3=Retail
    category_idx = np.random.randint(0, 4, n_samples)
    
    # Target: Did they convert? (1 = Yes, 0 = No)
    # Rule 1: More likely if User Points > Offer Points + 5000
    # Rule 2: Dining (2) has higher base conversion, Travel (0) has lower but big spikes
    conversion = np.zeros(n_samples)
    for i in range(n_samples):
        prob = 0.2
        if user_points[i] > offer_points[i] + 5000:
            prob += 0.4
        if category_idx[i] == 2: # Dining
            prob += 0.2
        if category_idx[i] == 0 and user_points[i] > 30000:
            prob += 0.5
            
        conversion[i] = 1 if np.random.rand() < prob else 0
        
    X = pd.DataFrame({
        'user_points': user_points,
        'offer_points': offer_points,
        'cat_travel': (category_idx == 0).astype(int),
        'cat_hotel': (category_idx == 1).astype(int),
        'cat_dining': (category_idx == 2).astype(int),
        'cat_retail': (category_idx == 3).astype(int)
    })
    y = conversion
    
    # Train LightGBM Binary Classifier
    print("Training LightGBM Model on Historical Data...")
    clf = lgb.LGBMClassifier(n_estimators=50, learning_rate=0.1, random_state=42)
    clf.fit(X, y)
    
    NBO_MODEL = clf
    return clf

@app.on_event("startup")
def startup_event():
    # Pre-train the model in memory on startup
    train_or_load_model()

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ML NBO Predictor (LightGBM)", "model_loaded": NBO_MODEL is not None}

@app.get("/predict/nbo")
def predict_next_best_offer(anonymous_id: str):
    """
    Predicts the Next Best Offer (NBO) for a given user using the LightGBM Gradient Boosting Model.
    """
    try:
        # 1. Fetch live user data and offers from DB securely
        user_query = "SELECT id, \"pointsBalance\" FROM \"User\" WHERE \"anonymousId\"=%(anon_id)s"
        user_df = pd.read_sql(user_query, con=engine, params={"anon_id": anonymous_id})
        if user_df.empty:
            raise HTTPException(status_code=404, detail="User not found")
            
        user_points = user_df.iloc[0]['pointsBalance']
        
        offers_df = pd.read_sql('SELECT id, "pointsRequired", categories FROM "Offer"', con=engine)
        if offers_df.empty:
             return {"recommendations": [], "model": "LightGBM_v1"}

        # 2. Build feature matrix for inference using the active User vs All Offers
        features = []
        offer_ids = []
        for _, offer in offers_df.iterrows():
            cats = [c.upper() for c in offer['categories']] if offer['categories'] else []
            feat = {
                'user_points': user_points,
                'offer_points': offer['pointsRequired'],
                'cat_travel': 1 if 'TRAVEL' in cats else 0,
                'cat_hotel':  1 if 'HOTEL' in cats else 0,
                'cat_dining': 1 if 'DINING' in cats else 0,
                'cat_retail': 1 if 'RETAIL' in cats else 0
            }
            features.append(feat)
            offer_ids.append(offer['id'])
            
        X_infer = pd.DataFrame(features)
        
        # 3. Predict Probabilities using LightGBM
        model = train_or_load_model()
        # predict_proba returns [prob_class_0, prob_class_1]
        probs = model.predict_proba(X_infer)[:, 1]
        
        # 4. Sort offers by highest conversion probability
        results = pd.DataFrame({'offer_id': offer_ids, 'prob': probs})
        results = results.sort_values(by='prob', ascending=False)
        
        top_offers = results.head(3)
        
        return {
            "anonymousId": anonymous_id,
            "recommendations": top_offers['offer_id'].tolist(),
            "model": "LightGBM_NBO_Classifier_v1",
            "confidence_score": round(float(top_offers['prob'].iloc[0]), 3) if not top_offers.empty else 0.0
        }

    except Exception as e:
        print(f"ML Processing Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"recommendations": [], "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
