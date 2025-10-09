/*
  # Enable pg_net extension for HTTP requests

  1. Extensions
    - Enable `pg_net` extension for making HTTP requests from database triggers
  
  2. Notes
    - Required for sending invitation emails via edge functions
    - Allows database triggers to make outbound HTTP requests
*/

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;