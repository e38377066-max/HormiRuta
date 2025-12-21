import json
import os
import requests
from flask import Blueprint, redirect, request, url_for, jsonify
from flask_login import login_user, logout_user, login_required, current_user
from oauthlib.oauth2 import WebApplicationClient
from models import db, User

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_OAUTH_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET", "")
GOOGLE_DISCOVERY_URL = "https://accounts.google.com/.well-known/openid-configuration"

DEV_REDIRECT_URL = f'https://{os.environ.get("REPLIT_DEV_DOMAIN", "localhost")}/api/auth/google/callback'

if GOOGLE_CLIENT_ID:
    print(f"""
=== Google OAuth Configuration ===
To make Google authentication work:
1. Go to https://console.cloud.google.com/apis/credentials
2. Create a new OAuth 2.0 Client ID
3. Add {DEV_REDIRECT_URL} to Authorized redirect URIs
==================================
""")
    client = WebApplicationClient(GOOGLE_CLIENT_ID)
else:
    client = None
    print("Warning: GOOGLE_OAUTH_CLIENT_ID not set. Google login will be disabled.")

google_auth = Blueprint("google_auth", __name__)


@google_auth.route("/api/auth/google/login")
def google_login():
    if not client:
        return jsonify({"error": "Google OAuth not configured"}), 500
    
    google_provider_cfg = requests.get(GOOGLE_DISCOVERY_URL).json()
    authorization_endpoint = google_provider_cfg["authorization_endpoint"]
    
    request_uri = client.prepare_request_uri(
        authorization_endpoint,
        redirect_uri=request.url_root.replace("http://", "https://") + "api/auth/google/callback",
        scope=["openid", "email", "profile"],
    )
    return redirect(request_uri)


@google_auth.route("/api/auth/google/callback")
def google_callback():
    if not client:
        return jsonify({"error": "Google OAuth not configured"}), 500
    
    code = request.args.get("code")
    google_provider_cfg = requests.get(GOOGLE_DISCOVERY_URL).json()
    token_endpoint = google_provider_cfg["token_endpoint"]
    
    token_url, headers, body = client.prepare_token_request(
        token_endpoint,
        authorization_response=request.url.replace("http://", "https://"),
        redirect_url=request.base_url.replace("http://", "https://"),
        code=code,
    )
    token_response = requests.post(
        token_url,
        headers=headers,
        data=body,
        auth=(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET),
    )
    
    client.parse_request_body_response(json.dumps(token_response.json()))
    
    userinfo_endpoint = google_provider_cfg["userinfo_endpoint"]
    uri, headers, body = client.add_token(userinfo_endpoint)
    userinfo_response = requests.get(uri, headers=headers, data=body)
    
    userinfo = userinfo_response.json()
    if not userinfo.get("email_verified"):
        return jsonify({"error": "Email not verified by Google"}), 400
    
    google_id = userinfo["sub"]
    email = userinfo["email"]
    name = userinfo.get("given_name", userinfo.get("name", "Usuario"))
    picture = userinfo.get("picture", "")
    
    user = User.query.filter_by(google_id=google_id).first()
    if not user:
        user = User.query.filter_by(email=email).first()
        if user:
            user.google_id = google_id
            user.profile_picture = picture
        else:
            user = User(
                username=name,
                email=email,
                google_id=google_id,
                profile_picture=picture
            )
            db.session.add(user)
        db.session.commit()
    
    login_user(user)
    
    frontend_url = os.environ.get("FRONTEND_URL", "/")
    return redirect(f"{frontend_url}?login=success")


@google_auth.route("/api/auth/google/mobile", methods=["POST"])
def google_mobile_auth():
    """Endpoint para autenticación desde la app móvil"""
    data = request.get_json()
    token = data.get("token")
    
    if not token:
        return jsonify({"error": "Token requerido"}), 400
    
    try:
        userinfo_response = requests.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if userinfo_response.status_code != 200:
            return jsonify({"error": "Token inválido"}), 401
        
        userinfo = userinfo_response.json()
        
        google_id = userinfo.get("sub")
        email = userinfo.get("email")
        name = userinfo.get("name", "Usuario")
        picture = userinfo.get("picture", "")
        
        if not email:
            return jsonify({"error": "No se pudo obtener el email"}), 400
        
        user = User.query.filter_by(google_id=google_id).first()
        if not user:
            user = User.query.filter_by(email=email).first()
            if user:
                user.google_id = google_id
                user.profile_picture = picture
            else:
                user = User(
                    username=name,
                    email=email,
                    google_id=google_id,
                    profile_picture=picture
                )
                db.session.add(user)
            db.session.commit()
        
        login_user(user)
        
        return jsonify({
            "success": True,
            "user": user.to_dict()
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
