import { TextStyle } from 'react-native';

const fredoka = 'Fredoka_700Bold';
const fredokaSemiBold = 'Fredoka_600SemiBold';
const nunito = 'Nunito_400Regular';
const nunitoMedium = 'Nunito_500Medium';
const nunitoSemiBold = 'Nunito_600SemiBold';
const nunitoBold = 'Nunito_700Bold';

export const typography = {
  // Display & Headings (Fredoka)
  display: {
    fontFamily: fredoka,
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: -0.02 * 36,
  } satisfies TextStyle,

  titleLarge: {
    fontFamily: fredoka,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: -0.02 * 32,
  } satisfies TextStyle,

  title: {
    fontFamily: fredokaSemiBold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.02 * 26,
  } satisfies TextStyle,

  button: {
    fontFamily: fredokaSemiBold,
    fontSize: 22,
    lineHeight: 28,
  } satisfies TextStyle,

  navTitle: {
    fontFamily: fredokaSemiBold,
    fontSize: 20,
    lineHeight: 24,
  } satisfies TextStyle,

  cardTitle: {
    fontFamily: fredokaSemiBold,
    fontSize: 18,
    lineHeight: 22,
  } satisfies TextStyle,

  sectionLabel: {
    fontFamily: fredokaSemiBold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0.06 * 16,
    textTransform: 'uppercase',
  } satisfies TextStyle,

  // Body & UI Text (Nunito)
  body: {
    fontFamily: nunito,
    fontSize: 18,
    lineHeight: 28,
  } satisfies TextStyle,

  bodySmall: {
    fontFamily: nunito,
    fontSize: 15,
    lineHeight: 18,
  } satisfies TextStyle,

  caption: {
    fontFamily: nunito,
    fontSize: 14,
    lineHeight: 18,
  } satisfies TextStyle,

  micro: {
    fontFamily: nunito,
    fontSize: 13,
    lineHeight: 16,
  } satisfies TextStyle,

  overline: {
    fontFamily: nunitoBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.06 * 12,
    textTransform: 'uppercase',
  } satisfies TextStyle,

  questionBody: {
    fontFamily: nunitoSemiBold,
    fontSize: 19,
    lineHeight: 28,
  } satisfies TextStyle,

  resultItem: {
    fontFamily: nunitoMedium,
    fontSize: 16,
    lineHeight: 20,
  } satisfies TextStyle,

  resultAnswer: {
    fontFamily: nunitoSemiBold,
    fontSize: 14,
    lineHeight: 18,
  } satisfies TextStyle,
} as const;
