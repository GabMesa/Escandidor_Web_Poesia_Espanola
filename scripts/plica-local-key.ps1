param([ValidateSet('protect','unprotect')][string]$Operation)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$plicaKeyBytes = [Convert]::FromBase64String([Console]::In.ReadToEnd().Trim())
$plicaEntropy = [Text.Encoding]::UTF8.GetBytes('MesaDePoesia.LocalPlicaKey.v1')
if ($Operation -eq 'protect') {
  $plicaProtectedBytes = [Security.Cryptography.ProtectedData]::Protect($plicaKeyBytes, $plicaEntropy, [Security.Cryptography.DataProtectionScope]::LocalMachine)
} else {
  $plicaProtectedBytes = [Security.Cryptography.ProtectedData]::Unprotect($plicaKeyBytes, $plicaEntropy, [Security.Cryptography.DataProtectionScope]::LocalMachine)
}
[Console]::Out.Write([Convert]::ToBase64String($plicaProtectedBytes))
