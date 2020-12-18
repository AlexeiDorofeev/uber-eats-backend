import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Verification } from 'src/users/entities/verification.entity';
import * as request from 'supertest';
import { getConnection, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';

jest.mock('got', () => {
  return {
    post: jest.fn(),
  };
});

const GRAPHQL_ENDPOINT = '/graphql';

const testUser = {
  email: 'dorofeev86@yahoo.com',
  password: '123',
};

describe('UserModule (e2e)', () => {
  let app: INestApplication;
  let usersRepository: Repository<User>;
  let verificationsRepository: Repository<Verification>;
  let jwtToken: string;

  const baseTest = () => request(app.getHttpServer()).post(GRAPHQL_ENDPOINT);
  const publicTest = (query: string) => baseTest().send({ query });
  const privateTest = (query: string) => baseTest().set('X-JWT', jwtToken).send({ query });

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    usersRepository = module.get<Repository<User>>(getRepositoryToken(User));
    verificationsRepository = module.get<Repository<Verification>>(
      getRepositoryToken(Verification)
    );
    await app.init();
  });

  afterAll(async () => {
    await getConnection().dropDatabase();
    app.close();
  });

  describe('createAccount', () => {
    it('should create account', () => {
      return publicTest(`mutation {
          createAccount(
            input: { email: "${testUser.email}", password: "${testUser.password}", role: Client }
          ) {
            error
            ok
          }
        }
        `)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.createAccount.ok).toBe(true);
          expect(res.body.data.createAccount.error).toBe(null);
        });
    });

    it('should fail if account already exists', () => {
      return publicTest(`mutation {
        createAccount(
          input: { email: "${testUser.email}", password: "123", role: Client }
        ) {
          error
          ok
        }
      }
      `)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.createAccount.ok).toBe(false);
          expect(res.body.data.createAccount.error).toEqual(expect.any(String));
        });
    });
  });

  describe('login', () => {
    it('should be able to login with correct credentials', () => {
      return publicTest(`mutation {
          login(input: { email: "${testUser.email}", password: "${testUser.password}" }) {
            error
            ok
            token
          }
        }
        `)
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: { login },
            },
          } = res;
          expect(login.ok).toBe(true);
          expect(login.error).toBe(null);
          expect(login.token).toEqual(expect.any(String));
          jwtToken = login.token;
        });
    });

    it('should not be able to login with wrong credentials', () => {
      return publicTest(`mutation {
          login(input: { email: "${testUser.email}", password: "567" }) {
            error
            ok
            token
          }
        }
        `)
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: { login },
            },
          } = res;
          expect(login.ok).toBe(false);
          expect(login.error).toBe('Wrong password');
          expect(login.token).toBe(null);
        });
    });
  });

  describe('userProfile', () => {
    let userId: number;
    beforeAll(async () => {
      const [user] = await usersRepository.find();
      userId = user.id;
    });
    it('should see a user profile', () => {
      return privateTest(`{
          userProfile(userId: ${userId}) {
            ok
            error
            user {
              id
            }
          }
        }
        `)
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                userProfile: {
                  ok,
                  error,
                  user: { id },
                },
              },
            },
          } = res;
          expect(ok).toBe(true);
          expect(error).toBe(null);
          expect(id).toBe(userId);
        });
    });
    it('should not find a profile', () => {
      return privateTest(`
          {
            userProfile(userId:666){
              ok
              error
              user {
                id
              }
            }
          }
        `)
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                userProfile: { ok, error, user },
              },
            },
          } = res;
          expect(ok).toBe(false);
          expect(error).toBe('User Not Found');
          expect(user).toBe(null);
        });
    });
  });

  describe('me', () => {
    it('should find my profile', () => {
      return privateTest(`{
          me {
            email
          }
        }
        `)
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                me: { email },
              },
            },
          } = res;
          expect(email).toBe(testUser.email);
        });
    });
    it('should not allow logged out users', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .send({
          query: `{
        me {
          email
        }
      }
      `,
        })
        .expect(200)
        .expect((res) => {
          const {
            body: { errors },
          } = res;
          const [error] = errors;
          expect(error.message).toBe('Forbidden resource');
        });
    });
  });

  describe('editProfile', () => {
    const NEW_EMAIL = 'doro@yahoo.com';
    it('should change email', () => {
      return request(app.getHttpServer())
        .post(GRAPHQL_ENDPOINT)
        .set('X-JWT', jwtToken)
        .send({
          query: `mutation {
        editProfile(input: { email: "${NEW_EMAIL}" }) {
          error
          ok
        }
      }
      `,
        })
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                editProfile: { ok, error },
              },
            },
          } = res;
          expect(ok).toBe(true);
          expect(error).toBe(null);
        })
        .then(() => {});
    });
    it('should have new email', () => {
      return privateTest(`{
          me {
            email
          }
        }
        `)
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                me: { email },
              },
            },
          } = res;
          expect(email).toBe(NEW_EMAIL);
        });
    });
  });

  describe('verifyEmail', () => {
    let verificationCode: string;
    beforeAll(async () => {
      const [verification] = await verificationsRepository.find();
      verificationCode = verification.code;
    });
    it('should verify email', () => {
      return publicTest(`mutation {
          verifyEmail(input: { code: "${verificationCode}" }) {
            error
            ok
          }
        }
        `)
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                verifyEmail: { ok, error },
              },
            },
          } = res;
          expect(ok).toBe(true);
          expect(error).toBe(null);
        });
    });
    it('should fail on wrong verification code', () => {
      return publicTest(`mutation {
        verifyEmail(input: { code: "xxxxxx" }) {
          error
          ok
        }
      }
      `)
        .expect(200)
        .expect((res) => {
          const {
            body: {
              data: {
                verifyEmail: { ok, error },
              },
            },
          } = res;
          expect(ok).toBe(false);
          expect(error).toBe('Verification not found.');
        });
    });
  });
});
