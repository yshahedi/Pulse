#ifndef ENCRYPTION_HXX
#define ENCRYPTION_HXX

#include <botan/auto_rng.h>
#include <botan/base64.h>
#include <botan/cipher_mode.h>
#include <botan/hex.h>
#include <string.h>
#include <botan/hash.h>

#include <botan/x509_ca.h>
#include <botan/x509cert.h>
#include <botan/x509path.h>
#include <botan/x509self.h>
#include <botan/aead.h>
#include <botan/pk_keys.h>
#include <botan/x509_key.h>
#include <botan/pk_algs.h>
#include <botan/pkcs8.h>
#include <botan/pubkey.h>
#include <botan/pem.h>
#include <botan/der_enc.h>
#include <botan/data_src.h>
#include <botan/ber_dec.h>
#include <botan/rsa.h>
#include <arpa/inet.h>

namespace Crypto
{

 

static std::unique_ptr<Botan::Private_Key> generateKeyPair(size_t bits = 2048) {
        Botan::AutoSeeded_RNG rng;
        return std::make_unique<Botan::RSA_PrivateKey>(rng, bits);
    }

static void savePrivateKey(const Botan::Private_Key& key, const std::string& filename, 
                        const std::string& password = "") {
    Botan::AutoSeeded_RNG rng;
    std::ofstream file(filename);
    if (password.empty()) {
        file << Botan::PKCS8::PEM_encode(key);
    } else {
        // Encrypt the private key with password
        file << Botan::PKCS8::PEM_encode(key, rng, password);
    }
}

static void savePublicKey(const Botan::Public_Key& key, const std::string& filename) {
        std::ofstream file(filename);
        file << Botan::X509::PEM_encode(key);
    }

static std::unique_ptr<Botan::Private_Key> loadPrivateKey(const std::string& filename,
                                                       const std::string& password = "") {
        Botan::DataSource_Stream in(filename);
        if (password.empty()) {
            return std::unique_ptr<Botan::Private_Key>(Botan::PKCS8::load_key(in));
        } else {
            return std::unique_ptr<Botan::Private_Key>(
                Botan::PKCS8::load_key(in, password));
        }
    }

static std::unique_ptr<Botan::Private_Key> loadPrivateKeyFromString(const std::string& key,
                                                       const std::string& password = "") {
        Botan::DataSource_Memory in(key);
        if (password.empty()) {
            return std::unique_ptr<Botan::Private_Key>(Botan::PKCS8::load_key(in));
        } else {
            return std::unique_ptr<Botan::Private_Key>(
                Botan::PKCS8::load_key(in, password));
        }
    }
    

static std::unique_ptr<Botan::Public_Key> loadPublicKey(const std::string& filename) {
        Botan::DataSource_Stream in(filename);
        return std::unique_ptr<Botan::Public_Key>(Botan::X509::load_key(in));
    }


static std::string hybridEncrypt(const Botan::Public_Key& key, const std::string& plaintext) {
        Botan::AutoSeeded_RNG rng;
        Botan::secure_vector<uint8_t> aes_key = rng.random_vec(32); 
        
        Botan::PK_Encryptor_EME rsa_encryptor(key, rng, "EME-PKCS1-v1_5");
        std::vector<uint8_t> encrypted_key = rsa_encryptor.encrypt(aes_key, rng);
        
        auto cipher = Botan::Cipher_Mode::create("AES-256/GCM", Botan::Cipher_Dir::Encryption);
        cipher->set_key(aes_key);
        
        Botan::secure_vector<uint8_t> iv = rng.random_vec(cipher->default_nonce_length());
        
        Botan::secure_vector<uint8_t> pt(plaintext.begin(), plaintext.end());
        cipher->start(iv);
        cipher->finish(pt);
        
        std::vector<uint8_t> result;
        
        uint32_t key_len = htonl(encrypted_key.size());
        result.insert(result.end(), (uint8_t*)&key_len, (uint8_t*)&key_len + 4);
        
        result.insert(result.end(), encrypted_key.begin(), encrypted_key.end());
        
        result.insert(result.end(), iv.begin(), iv.end());
        
        result.insert(result.end(), pt.begin(), pt.end());
        
        return Botan::hex_encode(result);
    }
    

static std::string hybridDecrypt(const Botan::Private_Key& key, const std::string& ciphertext_hex) {
    std::vector<uint8_t> data = Botan::hex_decode(ciphertext_hex);
    Botan::AutoSeeded_RNG rng;
    uint32_t key_len = 0;
    memcpy(&key_len, data.data(), 4);
    key_len = ntohl(key_len);
    
    size_t offset = 4;
    std::vector<uint8_t> encrypted_key(
        data.begin() + offset, 
        data.begin() + offset + key_len
    );
    offset += key_len;
    
    size_t iv_len = 12; 
    std::vector<uint8_t> iv(
        data.begin() + offset,
        data.begin() + offset + iv_len
    );
    offset += iv_len;
    
    std::vector<uint8_t> ciphertext(
        data.begin() + offset,
        data.end()
    );
    
    Botan::PK_Decryptor_EME rsa_decryptor(key, rng, "EME-PKCS1-v1_5");
    Botan::secure_vector<uint8_t> aes_key = 
        rsa_decryptor.decrypt(encrypted_key);
    
    auto cipher = Botan::Cipher_Mode::create("AES-256/GCM", Botan::Cipher_Dir::Decryption);
    cipher->set_key(aes_key);
    
    Botan::secure_vector<uint8_t> ct(ciphertext.begin(), ciphertext.end());
    cipher->start(iv);
    cipher->finish(ct);
    
    return std::string(ct.begin(), ct.end());
}

static std::string base64Encode(const std::string &myString)
{
    std::vector<uint8_t> myVector(myString.begin(), myString.end());
    uint8_t *uint_string = &myVector[0];
    return Botan::base64_encode(uint_string, myString.size());
}

static std::string base64Decode(const std::string &myString)
{
    Botan::secure_vector<uint8_t> output = Botan::base64_decode(myString);
    const std::string plainText(reinterpret_cast<const char *>(output.data()), output.size());
    return plainText;
}
static std::string encryptAES(const std::string &pPlainText, const std::string &pKey)
{
    Botan::AutoSeeded_RNG rng;

    const std::string plaintext = pPlainText;
    const std::vector<uint8_t> key = Botan::hex_decode(pKey);

    std::unique_ptr<Botan::Cipher_Mode> enc = Botan::Cipher_Mode::create("AES-256/CBC/PKCS7", Botan::Cipher_Dir::Encryption);
    enc->set_key(key);
    const Botan::secure_vector<uint8_t> iv = rng.random_vec(enc->default_nonce_length());
    Botan::secure_vector<uint8_t> pt(plaintext.data(), plaintext.data() + plaintext.length());

    enc->start(iv);
    enc->finish(pt);
    return Botan::hex_encode(iv) + ":" + Botan::hex_encode(pt);
}
static std::string decryptAES(const std::string &pCipherText, const std::string &pKey)
{
    Botan::AutoSeeded_RNG rng;
    std::string IV;
    std::string Cipher;
    std::size_t pos = pCipherText.find(":");
    IV = pCipherText.substr(0, pos);
    Cipher = pCipherText.substr(pos + 1);

    const std::vector<uint8_t> encode_str = Botan::hex_decode(Cipher);
    const std::vector<uint8_t> key = Botan::hex_decode(pKey);

    const Botan::InitializationVector iv(IV);
    std::unique_ptr<Botan::Cipher_Mode> enc = Botan::Cipher_Mode::create("AES-256/CBC/PKCS7", Botan::Cipher_Dir::Decryption);
    enc->set_key(key);
    enc->start(iv.bits_of());
    Botan::secure_vector<uint8_t> buf(encode_str.begin(), encode_str.end());
    enc->finish(buf);

    const std::string plainText(reinterpret_cast<const char *>(buf.data()), buf.size());
    return plainText;
}
static std::string makeMD5(const std::string pPlainText, const std::string pMode)
{

    std::vector<uint8_t> buf(pPlainText.data(), pPlainText.data() + pPlainText.length());
    std::unique_ptr<Botan::HashFunction> hash(Botan::HashFunction::create(pMode.c_str()));
    hash->update(buf.data(), pPlainText.size());
    return Botan::hex_encode(hash->final());
}
} // namespace Crypto

#endif // ENCRYPTION_HXX
