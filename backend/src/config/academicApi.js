function academicConfigError(message) {
  const error = new Error(message);
  error.code = 'ACADEMIC_API_CONFIGURATION_INVALID';
  return error;
}

function normalizeHost(value, name) {
  const host = String(value || '').trim().toLowerCase().replace(/\.$/, '');
  if (!host || host.includes('://') || !/^[a-z0-9.-]+(?::\d{1,5})?$/.test(host)) {
    throw academicConfigError(`A variável ${name} deve conter apenas host e porta opcional.`);
  }
  return host;
}

function loadAcademicApiConfig(env = process.env) {
  const rawFlag = String(env.ENABLE_ACADEMIC_API || '').trim().toLowerCase();
  if (rawFlag && !['true', 'false'].includes(rawFlag)) {
    throw academicConfigError('ENABLE_ACADEMIC_API aceita somente true ou false.');
  }
  if (rawFlag !== 'true') return { enabled: false, host: null };

  const host = normalizeHost(env.ACADEMIC_API_HOST, 'ACADEMIC_API_HOST');
  if (String(env.NODE_ENV || '').toLowerCase() === 'production') {
    const commercialHost = normalizeHost(env.COMMERCIAL_API_HOST, 'COMMERCIAL_API_HOST');
    if (host === commercialHost) {
      throw academicConfigError('ACADEMIC_API_HOST deve ser diferente de COMMERCIAL_API_HOST.');
    }
  }
  return { enabled: true, host };
}

function buildCommercialOpenapiSpec(openapiSpec) {
  const commercialSpec = JSON.parse(JSON.stringify(openapiSpec));
  delete commercialSpec.paths?.['/products'];
  delete commercialSpec.paths?.['/product/{id}']?.delete;
  delete commercialSpec.components?.securitySchemes?.basicAuth;
  return commercialSpec;
}

module.exports = { buildCommercialOpenapiSpec, loadAcademicApiConfig, normalizeHost };
